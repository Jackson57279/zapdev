/**
 * Apply AI Code Stream API Route
 * 
 * Parses AI-generated code from streaming response and applies it to the sandbox:
 * - Extracts files from <file> XML tags
 * - Detects packages from import statements
 * - Writes files to E2B sandbox
 * - Installs detected packages
 * - Streams progress updates via SSE
 * 
 * Based on open-lovable's apply-ai-code-stream implementation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { Sandbox } from '@e2b/code-interpreter';
import {
  createSSEStream,
  getSSEHeaders,
  type ApplyCodeRequest,
  type ParsedAIResponse,
  type ConversationState,
  type ConversationEdit,
} from '@/lib/streaming';

// Force dynamic route to enable streaming
export const dynamic = 'force-dynamic';

// ============================================================================
// Global State (In production, use Convex for persistence)
// ============================================================================

declare global {
  // eslint-disable-next-line no-var
  var conversationState: ConversationState | null;
  // eslint-disable-next-line no-var
  var activeSandbox: any;
  // eslint-disable-next-line no-var
  var existingFiles: Set<string>;
  // eslint-disable-next-line no-var
  var sandboxState: {
    fileCache?: {
      files: Record<string, { content: string; lastModified: number }>;
    };
  } | null;
}

// ============================================================================
// Configuration
// ============================================================================

const CONFIG_FILES = [
  'tailwind.config.js',
  'tailwind.config.ts',
  'vite.config.js',
  'vite.config.ts',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'postcss.config.js',
  'postcss.config.mjs',
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract packages from import statements in code.
 */
function extractPackagesFromCode(content: string): string[] {
  const packages: string[] = [];
  const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    
    // Skip relative imports, built-ins, and internal paths
    if (
      !importPath.startsWith('.') &&
      !importPath.startsWith('/') &&
      importPath !== 'react' &&
      importPath !== 'react-dom' &&
      !importPath.startsWith('@/')
    ) {
      // Extract package name (handle scoped packages like @heroicons/react)
      const packageName = importPath.startsWith('@')
        ? importPath.split('/').slice(0, 2).join('/')
        : importPath.split('/')[0];

      if (!packages.includes(packageName)) {
        packages.push(packageName);
      }
    }
  }

  return packages;
}

/**
 * Parse AI response to extract files, packages, and commands.
 */
function parseAIResponse(response: string): ParsedAIResponse {
  const sections: ParsedAIResponse = {
    files: [],
    packages: [],
    commands: [],
    structure: null,
    explanation: '',
    template: '',
  };

  // Parse file sections - handle duplicates and prefer complete versions
  const fileMap = new Map<string, { content: string; isComplete: boolean }>();

  const fileRegex = /<file path="([^"]+)">([\s\S]*?)(?:<\/file>|$)/g;
  let match;

  while ((match = fileRegex.exec(response)) !== null) {
    const filePath = match[1];
    const content = match[2].trim();
    const hasClosingTag = response.substring(match.index, match.index + match[0].length).includes('</file>');

    // Check if this file already exists in our map
    const existing = fileMap.get(filePath);

    // Decide whether to keep this version
    let shouldReplace = false;
    if (!existing) {
      shouldReplace = true; // First occurrence
    } else if (!existing.isComplete && hasClosingTag) {
      shouldReplace = true; // Replace incomplete with complete
      console.log(`[apply-ai-code-stream] Replacing incomplete ${filePath} with complete version`);
    } else if (existing.isComplete && hasClosingTag && content.length > existing.content.length) {
      shouldReplace = true; // Replace with longer complete version
      console.log(`[apply-ai-code-stream] Replacing ${filePath} with longer complete version`);
    } else if (!existing.isComplete && !hasClosingTag && content.length > existing.content.length) {
      shouldReplace = true; // Both incomplete, keep longer one
    }

    if (shouldReplace) {
      // Validate content - reject obviously broken content
      if (content.includes('...') && !content.includes('...props') && !content.includes('...rest')) {
        console.warn(`[apply-ai-code-stream] Warning: ${filePath} contains ellipsis, may be truncated`);
        // Still use it if it's the only version we have
        if (!existing) {
          fileMap.set(filePath, { content, isComplete: hasClosingTag });
        }
      } else {
        fileMap.set(filePath, { content, isComplete: hasClosingTag });
      }
    }
  }

  // Convert map to array and extract packages
  for (const [path, { content, isComplete }] of fileMap.entries()) {
    if (!isComplete) {
      console.log(`[apply-ai-code-stream] Warning: File ${path} appears to be truncated (no closing tag)`);
    }

    sections.files.push({ path, content });

    // Extract packages from file content
    const filePackages = extractPackagesFromCode(content);
    for (const pkg of filePackages) {
      if (!sections.packages.includes(pkg)) {
        sections.packages.push(pkg);
        console.log(`[apply-ai-code-stream] 📦 Package detected from imports: ${pkg}`);
      }
    }
  }

  // Parse markdown code blocks with file paths
  const markdownFileRegex = /```(?:file )?path="([^"]+)"\n([\s\S]*?)```/g;
  while ((match = markdownFileRegex.exec(response)) !== null) {
    const filePath = match[1];
    const content = match[2].trim();
    
    // Don't add duplicate files
    if (!sections.files.some(f => f.path === filePath)) {
      sections.files.push({ path: filePath, content });

      // Extract packages
      const filePackages = extractPackagesFromCode(content);
      for (const pkg of filePackages) {
        if (!sections.packages.includes(pkg)) {
          sections.packages.push(pkg);
        }
      }
    }
  }

  // Parse commands
  const cmdRegex = /<command>(.*?)<\/command>/g;
  while ((match = cmdRegex.exec(response)) !== null) {
    sections.commands.push(match[1].trim());
  }

  // Parse packages - support both <package> and <packages> tags
  const pkgRegex = /<package>(.*?)<\/package>/g;
  while ((match = pkgRegex.exec(response)) !== null) {
    const pkg = match[1].trim();
    if (!sections.packages.includes(pkg)) {
      sections.packages.push(pkg);
    }
  }

  // Parse <packages> tag with multiple packages
  const packagesRegex = /<packages>([\s\S]*?)<\/packages>/;
  const packagesMatch = response.match(packagesRegex);
  if (packagesMatch) {
    const packagesContent = packagesMatch[1].trim();
    const packagesList = packagesContent
      .split(/[\n,]+/)
      .map(pkg => pkg.trim())
      .filter(pkg => pkg.length > 0);
    
    for (const pkg of packagesList) {
      if (!sections.packages.includes(pkg)) {
        sections.packages.push(pkg);
      }
    }
  }

  // Parse structure
  const structureMatch = response.match(/<structure>([\s\S]*?)<\/structure>/);
  if (structureMatch) {
    sections.structure = structureMatch[1].trim();
  }

  // Parse explanation
  const explanationMatch = response.match(/<explanation>([\s\S]*?)<\/explanation>/);
  if (explanationMatch) {
    sections.explanation = explanationMatch[1].trim();
  }

  // Parse template
  const templateMatch = response.match(/<template>(.*?)<\/template>/);
  if (templateMatch) {
    sections.template = templateMatch[1].trim();
  }

  return sections;
}

/**
 * Normalize file path for sandbox.
 */
function normalizeFilePath(path: string): string {
  let normalized = path;
  
  // Remove leading slash
  if (normalized.startsWith('/')) {
    normalized = normalized.substring(1);
  }
  
  // Add src/ prefix if needed
  const fileName = normalized.split('/').pop() || '';
  if (
    !normalized.startsWith('src/') &&
    !normalized.startsWith('public/') &&
    normalized !== 'index.html' &&
    !CONFIG_FILES.includes(fileName)
  ) {
    normalized = 'src/' + normalized;
  }
  
  return normalized;
}

/**
 * Clean file content (remove CSS imports, fix Tailwind classes).
 */
function cleanFileContent(content: string, filePath: string): string {
  let cleaned = content;
  
  // Remove CSS imports from JSX/JS files (we're using Tailwind)
  if (filePath.endsWith('.jsx') || filePath.endsWith('.js') || filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    cleaned = cleaned.replace(/import\s+['"]\.\/[^'"]+\.css['"];?\s*\n?/g, '');
  }
  
  // Fix common Tailwind CSS errors in CSS files
  if (filePath.endsWith('.css')) {
    cleaned = cleaned.replace(/shadow-3xl/g, 'shadow-2xl');
    cleaned = cleaned.replace(/shadow-4xl/g, 'shadow-2xl');
    cleaned = cleaned.replace(/shadow-5xl/g, 'shadow-2xl');
  }
  
  return cleaned;
}

// ============================================================================
// Main Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: ApplyCodeRequest = await request.json();
    const { response, isEdit = false, packages = [], sandboxId } = body;

    console.log('[apply-ai-code-stream] Received request:', {
      responseLength: response?.length,
      isEdit,
      packagesProvided: packages?.length || 0,
      sandboxId,
    });

    if (!response) {
      return NextResponse.json(
        { success: false, error: 'response is required' },
        { status: 400 }
      );
    }

    // Parse the AI response
    const parsed = parseAIResponse(response);
    
    console.log('[apply-ai-code-stream] Parsed result:', {
      files: parsed.files.length,
      packages: parsed.packages.length,
      commands: parsed.commands.length,
    });

    if (parsed.files.length > 0) {
      parsed.files.forEach(f => {
        console.log(`[apply-ai-code-stream] - ${f.path} (${f.content.length} chars)`);
      });
    }

    // Initialize global state if needed
    if (!global.existingFiles) {
      global.existingFiles = new Set<string>();
    }

    // Get or create sandbox
    let sandbox = global.activeSandbox;
    
    if (!sandbox) {
      if (sandboxId) {
        console.log(`[apply-ai-code-stream] Connecting to existing sandbox: ${sandboxId}`);
        try {
          sandbox = await Sandbox.connect(sandboxId, {
            apiKey: process.env.E2B_API_KEY,
          });
          global.activeSandbox = sandbox;
        } catch (error) {
          console.error(`[apply-ai-code-stream] Failed to connect to sandbox ${sandboxId}:`, error);
          return NextResponse.json({
            success: false,
            error: `Failed to connect to sandbox ${sandboxId}. The sandbox may have expired.`,
            parsedFiles: parsed.files,
            message: `Parsed ${parsed.files.length} files but couldn't apply them - sandbox connection failed.`,
          }, { status: 500 });
        }
      } else {
        console.log('[apply-ai-code-stream] No sandbox available, creating new one...');
        try {
          sandbox = await Sandbox.create('zapdev', {
            apiKey: process.env.E2B_API_KEY,
            timeoutMs: 30 * 60 * 1000, // 30 minutes
          });
          global.activeSandbox = sandbox;
          console.log(`[apply-ai-code-stream] Created new sandbox: ${sandbox.sandboxId}`);
        } catch (error) {
          console.error('[apply-ai-code-stream] Failed to create sandbox:', error);
          return NextResponse.json({
            success: false,
            error: `Failed to create sandbox: ${error instanceof Error ? error.message : 'Unknown error'}`,
            parsedFiles: parsed.files,
            message: `Parsed ${parsed.files.length} files but couldn't apply them - sandbox creation failed.`,
          }, { status: 500 });
        }
      }
    }

    // Create SSE stream
    const { stream, sendProgress, close } = createSSEStream();

    // Start processing in background
    (async () => {
      const results = {
        filesCreated: [] as string[],
        filesUpdated: [] as string[],
        packagesInstalled: [] as string[],
        packagesFailed: [] as string[],
        commandsExecuted: [] as string[],
        errors: [] as string[],
      };

      try {
        await sendProgress({
          type: 'start',
          message: 'Starting code application...',
          totalSteps: 3,
        });

        // Step 1: Install packages
        const packagesArray = Array.isArray(packages) ? packages : [];
        const parsedPackages = Array.isArray(parsed.packages) ? parsed.packages : [];

        // Combine and deduplicate packages
        const allPackages = [...packagesArray, ...parsedPackages];
        const uniquePackages = [...new Set(allPackages)]
          .filter(pkg => pkg && typeof pkg === 'string' && pkg.trim() !== '')
          .filter(pkg => pkg !== 'react' && pkg !== 'react-dom'); // Filter pre-installed

        if (allPackages.length !== uniquePackages.length) {
          console.log(`[apply-ai-code-stream] Removed ${allPackages.length - uniquePackages.length} duplicate packages`);
        }

        if (uniquePackages.length > 0) {
          await sendProgress({
            type: 'step',
            step: 1,
            message: `Installing ${uniquePackages.length} packages...`,
            packages: uniquePackages,
          });

          try {
            // Install packages using npm
            const installCmd = `npm install ${uniquePackages.join(' ')}`;
            console.log(`[apply-ai-code-stream] Running: ${installCmd}`);
            
            const installResult = await sandbox!.commands.run(installCmd, {
              onStdout: (data: string) => {
                console.log('[apply-ai-code-stream] npm stdout:', data);
              },
              onStderr: (data: string) => {
                console.log('[apply-ai-code-stream] npm stderr:', data);
              },
            });

            if (installResult.exitCode === 0) {
              results.packagesInstalled = uniquePackages;
              await sendProgress({
                type: 'package-progress',
                message: `Successfully installed ${uniquePackages.length} packages`,
                installedPackages: uniquePackages,
              });
            } else {
              console.error('[apply-ai-code-stream] Package installation failed:', installResult.stderr);
              results.errors.push(`Package installation failed: ${installResult.stderr}`);
              await sendProgress({
                type: 'warning',
                message: 'Some packages failed to install. Continuing with file creation...',
              });
            }
          } catch (error) {
            console.error('[apply-ai-code-stream] Error installing packages:', error);
            results.errors.push(`Package installation error: ${(error as Error).message}`);
            await sendProgress({
              type: 'warning',
              message: `Package installation skipped (${(error as Error).message}). Continuing with file creation...`,
            });
          }
        } else {
          await sendProgress({
            type: 'step',
            step: 1,
            message: 'No additional packages to install, skipping...',
          });
        }

        // Step 2: Create/update files
        const filesArray = Array.isArray(parsed.files) ? parsed.files : [];
        await sendProgress({
          type: 'step',
          step: 2,
          message: `Creating ${filesArray.length} files...`,
        });

        // Filter out config files
        const filteredFiles = filesArray.filter(file => {
          if (!file || typeof file !== 'object') return false;
          const fileName = (file.path || '').split('/').pop() || '';
          return !CONFIG_FILES.includes(fileName);
        });

        console.log(`[apply-ai-code-stream] Processing ${filteredFiles.length} files (filtered ${filesArray.length - filteredFiles.length} config files)`);

        for (const [index, file] of filteredFiles.entries()) {
          try {
            await sendProgress({
              type: 'file-progress',
              current: index + 1,
              total: filteredFiles.length,
              fileName: file.path,
              action: 'creating',
            });

            // Normalize path
            const normalizedPath = normalizeFilePath(file.path);
            const isUpdate = global.existingFiles?.has(normalizedPath) || false;

            // Clean content
            const cleanedContent = cleanFileContent(file.content, normalizedPath);

            // Create directory if needed
            const dirPath = normalizedPath.includes('/') 
              ? normalizedPath.substring(0, normalizedPath.lastIndexOf('/')) 
              : '';
            
            if (dirPath) {
              await sandbox!.commands.run(`mkdir -p ${dirPath}`);
            }

            // Write file
            await sandbox!.files.write(normalizedPath, cleanedContent);

            // Update file cache
            if (!global.sandboxState) {
              global.sandboxState = { fileCache: { files: {} } };
            }
            if (!global.sandboxState.fileCache) {
              global.sandboxState.fileCache = { files: {} };
            }
            global.sandboxState.fileCache.files[normalizedPath] = {
              content: cleanedContent,
              lastModified: Date.now(),
            };

            // Track file
            if (isUpdate) {
              results.filesUpdated.push(normalizedPath);
            } else {
              results.filesCreated.push(normalizedPath);
              global.existingFiles?.add(normalizedPath);
            }

            await sendProgress({
              type: 'file-complete',
              fileName: normalizedPath,
              action: isUpdate ? 'updated' : 'created',
            });
          } catch (error) {
            const errorMsg = `Failed to create ${file.path}: ${(error as Error).message}`;
            results.errors.push(errorMsg);
            await sendProgress({
              type: 'file-error',
              fileName: file.path,
              error: (error as Error).message,
            });
          }
        }

        // Step 3: Execute commands
        const commandsArray = Array.isArray(parsed.commands) ? parsed.commands : [];
        if (commandsArray.length > 0) {
          await sendProgress({
            type: 'step',
            step: 3,
            message: `Executing ${commandsArray.length} commands...`,
          });

          for (const [index, cmd] of commandsArray.entries()) {
            try {
              await sendProgress({
                type: 'command-progress',
                current: index + 1,
                total: commandsArray.length,
                command: cmd,
                action: 'executing',
              });

              const result = await sandbox!.commands.run(cmd);

              if (result.stdout) {
                await sendProgress({
                  type: 'command-output',
                  command: cmd,
                  output: result.stdout,
                  stream: 'stdout',
                });
              }

              if (result.stderr) {
                await sendProgress({
                  type: 'command-output',
                  command: cmd,
                  output: result.stderr,
                  stream: 'stderr',
                });
              }

              results.commandsExecuted.push(cmd);

              await sendProgress({
                type: 'command-complete',
                command: cmd,
                exitCode: result.exitCode,
                success: result.exitCode === 0,
              });
            } catch (error) {
              const errorMsg = `Failed to execute ${cmd}: ${(error as Error).message}`;
              results.errors.push(errorMsg);
              await sendProgress({
                type: 'command-error',
                command: cmd,
                error: (error as Error).message,
              });
            }
          }
        }

        // Update conversation state
        if (global.conversationState && results.filesCreated.length > 0) {
          const messages = global.conversationState.context.messages;
          if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            if (lastMessage.role === 'user') {
              lastMessage.metadata = {
                ...lastMessage.metadata,
                editedFiles: results.filesCreated,
              };
            }
          }

          // Track in project evolution
          if (global.conversationState.context.projectEvolution) {
            global.conversationState.context.projectEvolution.majorChanges.push({
              timestamp: Date.now(),
              description: parsed.explanation || 'Code applied',
              filesAffected: results.filesCreated,
            });
          }

          global.conversationState.lastUpdated = Date.now();
        }

        // Send final results
        await sendProgress({
          type: 'complete',
          results,
          explanation: parsed.explanation,
          structure: parsed.structure,
          message: `Successfully applied ${results.filesCreated.length} files`,
        });

      } catch (error) {
        console.error('[apply-ai-code-stream] Stream processing error:', error);
        await sendProgress({
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        await close();
      }
    })();

    // Return the stream
    return new Response(stream, {
      headers: getSSEHeaders(),
    });

  } catch (error) {
    console.error('[apply-ai-code-stream] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to parse AI code' },
      { status: 500 }
    );
  }
}
