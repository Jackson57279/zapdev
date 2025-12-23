/**
 * Streaming Code Generation API Route
 * 
 * Main endpoint for AI-powered code generation with:
 * - Real-time streaming via Server-Sent Events (SSE)
 * - Multi-model AI support (Anthropic, OpenAI, Google, Groq)
 * - Conversation context awareness
 * - Edit mode for surgical file updates
 * - Automatic package detection
 * 
 * Based on open-lovable's streaming-first architecture.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createSSEStream,
  getSSEHeaders,
  createStreamingRequestWithRetry,
  getProviderAndModel,
  selectModelForTask,
  analyzeUserPreferences,
  type ConversationState,
  type ConversationMessage,
  type ConversationEdit,
  type EditContext,
  type GenerateCodeRequest,
  type StreamEvent,
} from '@/lib/streaming';

// Force dynamic route to enable streaming
export const dynamic = 'force-dynamic';

// ============================================================================
// Global State (In production, use Redis or database)
// ============================================================================

declare global {
  // eslint-disable-next-line no-var
  var conversationState: ConversationState | null;
  // eslint-disable-next-line no-var
  var sandboxFileCache: Record<string, { content: string; lastModified: number }> | null;
}

// ============================================================================
// System Prompts
// ============================================================================

const BASE_SYSTEM_PROMPT = `You are an expert React developer with perfect memory of the conversation. You maintain context across messages and remember scraped websites, generated components, and applied code. Generate clean, modern React code for Vite applications.

CRITICAL RULES - YOUR MOST IMPORTANT INSTRUCTIONS:
1. **DO EXACTLY WHAT IS ASKED - NOTHING MORE, NOTHING LESS**
   - Don't add features not requested
   - Don't fix unrelated issues
   - Don't improve things not mentioned
2. **CHECK App.jsx FIRST** - ALWAYS see what components exist before creating new ones
3. **NAVIGATION LIVES IN Header.jsx** - Don't create Nav.jsx if Header exists with nav
4. **USE STANDARD TAILWIND CLASSES ONLY**:
   - ✅ CORRECT: bg-white, text-black, bg-blue-500, bg-gray-100, text-gray-900
   - ❌ WRONG: bg-background, text-foreground, bg-primary, bg-muted, text-secondary
   - Use ONLY classes from the official Tailwind CSS documentation
5. **FILE COUNT LIMITS**:
   - Simple style/text change = 1 file ONLY
   - New component = 2 files MAX (component + parent)
   - If >3 files, YOU'RE DOING TOO MUCH
6. **DO NOT CREATE SVGs FROM SCRATCH**:
   - NEVER generate custom SVG code unless explicitly asked
   - Use existing icon libraries (lucide-react, heroicons, etc.)

CRITICAL STYLING RULES:
- NEVER use inline styles with style={{ }} in JSX
- NEVER use <style jsx> tags
- ALWAYS use Tailwind CSS classes for ALL styling
- ONLY create src/index.css with the @tailwind directives

CRITICAL STRING AND SYNTAX RULES:
- ALWAYS escape apostrophes in strings: use \\' instead of '
- NEVER use curly quotes or smart quotes
- When working with scraped content, ALWAYS sanitize quotes first

CRITICAL: When asked to create a React app or components:
- ALWAYS CREATE ALL FILES IN FULL - never provide partial implementations
- NEVER create tailwind.config.js - it's already configured in the template
- NEVER create vite.config.js - it's already configured in the template
- NEVER create package.json - it's already configured in the template

Use this XML format for React components:

<file path="src/index.css">
@tailwind base;
@tailwind components;
@tailwind utilities;
</file>

<file path="src/App.jsx">
// Main App component
</file>

<file path="src/components/Example.jsx">
// Your React component code here
</file>

CRITICAL COMPLETION RULES:
1. NEVER say "I'll continue with the remaining components"
2. Generate ALL components in ONE response
3. Complete EVERYTHING before ending your response`;

const EDIT_MODE_SYSTEM_PROMPT = `
CRITICAL: THIS IS AN EDIT TO AN EXISTING APPLICATION

YOU MUST FOLLOW THESE EDIT RULES:
0. NEVER create tailwind.config.js, vite.config.js, package.json, or any config files!
1. DO NOT regenerate the entire application
2. DO NOT create files that already exist (like App.jsx, index.css)
3. ONLY edit the EXACT files needed for the requested change
4. If the user says "update the header", ONLY edit the Header component
5. If you're unsure which file to edit, choose the SINGLE most specific one

CRITICAL FILE MODIFICATION RULES:
- **NEVER TRUNCATE FILES** - Always return COMPLETE files
- **NO ELLIPSIS (...)** - Include every single line of code
- Count the files you're about to generate
- If the user asked to change ONE thing, generate ONE file

CRITICAL: DO NOT REDESIGN OR REIMAGINE COMPONENTS
- "update" means make a small change, NOT redesign
- "change X to Y" means ONLY change X to Y, nothing else
- Preserve ALL existing functionality unless explicitly asked to change`;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build conversation context for the system prompt.
 */
function buildConversationContext(state: ConversationState | null): string {
  if (!state || state.context.messages.length <= 1) {
    return '';
  }

  let context = '\n\n## Conversation History (Recent)\n';

  // Include recent edits (last 3)
  const recentEdits = state.context.edits.slice(-3);
  if (recentEdits.length > 0) {
    context += '\n### Recent Edits:\n';
    recentEdits.forEach(edit => {
      const files = edit.targetFiles.map(f => f.split('/').pop()).join(', ');
      context += `- "${edit.userRequest}" → ${edit.editType} (${files})\n`;
    });
  }

  // Include recently created files - CRITICAL for preventing duplicates
  const recentMsgs = state.context.messages.slice(-5);
  const recentlyCreatedFiles: string[] = [];
  recentMsgs.forEach(msg => {
    if (msg.metadata?.editedFiles) {
      recentlyCreatedFiles.push(...msg.metadata.editedFiles);
    }
  });

  if (recentlyCreatedFiles.length > 0) {
    const uniqueFiles = [...new Set(recentlyCreatedFiles)];
    context += '\n### 🚨 RECENTLY CREATED/EDITED FILES (DO NOT RECREATE THESE):\n';
    uniqueFiles.forEach(file => {
      context += `- ${file}\n`;
    });
    context += '\nIf the user mentions any of these components, UPDATE the existing file!\n';
  }

  // Include recent messages (last 5)
  const recentMessages = recentMsgs.filter(m => m.role === 'user').slice(0, -1);
  if (recentMessages.length > 0) {
    context += '\n### Recent Messages:\n';
    recentMessages.forEach(msg => {
      const truncated = msg.content.length > 100 
        ? msg.content.substring(0, 100) + '...' 
        : msg.content;
      context += `- "${truncated}"\n`;
    });
  }

  // Include major changes (last 2)
  const majorChanges = state.context.projectEvolution.majorChanges.slice(-2);
  if (majorChanges.length > 0) {
    context += '\n### Recent Changes:\n';
    majorChanges.forEach(change => {
      context += `- ${change.description}\n`;
    });
  }

  // Include user preferences
  const userPrefs = analyzeUserPreferences(state.context.messages);
  if (userPrefs.commonPatterns.length > 0) {
    context += '\n### User Preferences:\n';
    context += `- Edit style: ${userPrefs.preferredEditStyle}\n`;
  }

  // Limit total context length
  if (context.length > 2000) {
    context = context.substring(0, 2000) + '\n[Context truncated]';
  }

  return context;
}

/**
 * Build the full system prompt.
 */
function buildSystemPrompt(
  isEdit: boolean,
  conversationContext: string,
  editContext?: EditContext,
): string {
  let prompt = BASE_SYSTEM_PROMPT;
  prompt += conversationContext;

  if (isEdit) {
    prompt += EDIT_MODE_SYSTEM_PROMPT;

    if (editContext) {
      prompt += `

TARGETED EDIT MODE ACTIVE
- Edit Type: ${editContext.editIntent.type}
- Confidence: ${editContext.editIntent.confidence}
- Files to Edit: ${editContext.primaryFiles.join(', ')}

🚨 CRITICAL RULE - VIOLATION WILL RESULT IN FAILURE 🚨
YOU MUST ***ONLY*** GENERATE THE FILES LISTED ABOVE!

ABSOLUTE REQUIREMENTS:
1. COUNT the files in "Files to Edit" - that's EXACTLY how many files you must generate
2. If "Files to Edit" shows ONE file, generate ONLY that ONE file
3. DO NOT generate App.jsx unless it's EXPLICITLY listed in "Files to Edit"
4. DO NOT "helpfully" update related files
5. DO NOT fix unrelated issues you notice`;
    }
  }

  // Add code generation rules
  prompt += `

🚨 CRITICAL CODE GENERATION RULES 🚨:
1. NEVER truncate ANY code - ALWAYS write COMPLETE files
2. NEVER use "..." anywhere in your code
3. ALWAYS close ALL tags, quotes, brackets, and parentheses
4. If you run out of space, prioritize completing the current file`;

  return prompt;
}

/**
 * Extract packages from import statements.
 */
function extractPackagesFromCode(content: string): string[] {
  const packages: string[] = [];
  const importRegex = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    const importPath = match[1];
    // Skip relative imports and built-in React
    if (
      !importPath.startsWith('.') &&
      !importPath.startsWith('/') &&
      importPath !== 'react' &&
      importPath !== 'react-dom' &&
      !importPath.startsWith('@/')
    ) {
      // Extract package name (handle scoped packages)
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

// ============================================================================
// Main Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body: GenerateCodeRequest = await request.json();
    const { prompt, model: requestedModel = 'auto', isEdit = false, context } = body;

    console.log('[generate-ai-code-stream] Received request:', {
      prompt: prompt?.substring(0, 100),
      isEdit,
      model: requestedModel,
      hasContext: !!context,
    });

    if (!prompt) {
      return NextResponse.json(
        { success: false, error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // Select model
    const model = requestedModel === 'auto'
      ? selectModelForTask(prompt)
      : requestedModel;

    console.log(`[generate-ai-code-stream] Using model: ${model}`);

    // Initialize or update conversation state
    if (!global.conversationState) {
      global.conversationState = {
        conversationId: `conv-${Date.now()}`,
        projectId: context?.projectId || 'unknown',
        startedAt: Date.now(),
        lastUpdated: Date.now(),
        context: {
          messages: [],
          edits: [],
          projectEvolution: { majorChanges: [] },
          userPreferences: {},
        },
      };
    }

    // Add user message to history
    const userMessage: ConversationMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
      metadata: {
        sandboxId: context?.sandboxId,
        projectId: context?.projectId,
      },
    };
    global.conversationState.context.messages.push(userMessage);

    // Prune old messages to prevent unbounded growth
    if (global.conversationState.context.messages.length > 20) {
      global.conversationState.context.messages = 
        global.conversationState.context.messages.slice(-15);
    }

    // Create SSE stream
    const { stream, sendProgress, close } = createSSEStream();

    // Start processing in background
    (async () => {
      try {
        await sendProgress({ type: 'status', message: 'Initializing AI...' });

        // Build conversation context
        const conversationContext = buildConversationContext(global.conversationState);

        // TODO: For edit mode, implement edit context analysis
        let editContext: EditContext | undefined;
        if (isEdit && context?.currentFiles) {
          // Simple edit context for now
          editContext = {
            primaryFiles: Object.keys(context.currentFiles),
            contextFiles: [],
            systemPrompt: '',
            editIntent: {
              type: 'UPDATE_COMPONENT',
              description: 'User-requested edit',
              targetFiles: Object.keys(context.currentFiles),
              confidence: 0.8,
            },
          };

          await sendProgress({
            type: 'status',
            message: `Identified ${editContext.primaryFiles.length} files for editing`,
          });
        }

        // Build system prompt
        const systemPrompt = buildSystemPrompt(isEdit, conversationContext, editContext);

        await sendProgress({ type: 'status', message: 'Planning application structure...' });

        // Build full prompt with context
        let fullPrompt = prompt;
        if (context) {
          const contextParts: string[] = [];

          if (context.sandboxId) {
            contextParts.push(`Current sandbox ID: ${context.sandboxId}`);
          }

          if (context.structure) {
            contextParts.push(`Current file structure:\n${context.structure}`);
          }

          if (context.currentFiles && Object.keys(context.currentFiles).length > 0) {
            if (isEdit) {
              contextParts.push('\nEXISTING APPLICATION - TARGETED EDIT REQUIRED');
              contextParts.push('\nCurrent project files:');

              for (const [path, content] of Object.entries(context.currentFiles)) {
                if (typeof content === 'string') {
                  contextParts.push(`\n<file path="${path}">\n${content}\n</file>`);
                }
              }

              contextParts.push('\n🚨 CRITICAL: Only modify the files needed for the request!');
            }
          }

          if (contextParts.length > 0) {
            fullPrompt = `CONTEXT:\n${contextParts.join('\n')}\n\nUSER REQUEST:\n${prompt}`;
          }
        }

        // Create streaming request
        const result = await createStreamingRequestWithRetry({
          model,
          messages: [{ role: 'user', content: fullPrompt }],
          systemPrompt,
          maxTokens: 8192,
          temperature: 0.7,
        });

        // Stream the response
        let generatedCode = '';
        let currentFilePath = '';
        let componentCount = 0;
        const packagesToInstall: string[] = [];

        for await (const textPart of result.textStream) {
          const text = textPart || '';
          generatedCode += text;

          // Log streaming chunks
          process.stdout.write(text);

          // Stream the raw text
          await sendProgress({
            type: 'stream',
            text: text,
            raw: true,
          });

          // Check for file boundaries
          if (text.includes('<file path="')) {
            const pathMatch = text.match(/<file path="([^"]+)"/);
            if (pathMatch) {
              currentFilePath = pathMatch[1];
            }
          }

          // Check for file end
          if (currentFilePath && text.includes('</file>')) {
            if (currentFilePath.includes('components/')) {
              componentCount++;
              const componentName = currentFilePath.split('/').pop()?.replace(/\.(jsx|tsx)$/, '') || 'Component';
              await sendProgress({
                type: 'component',
                name: componentName,
                path: currentFilePath,
                index: componentCount,
              });
            }
            currentFilePath = '';
          }
        }

        console.log('\n\n[generate-ai-code-stream] Streaming complete.');

        // Extract packages from generated code
        const detectedPackages = extractPackagesFromCode(generatedCode);
        if (isEdit && detectedPackages.length > 0) {
          detectedPackages.forEach(pkg => {
            if (!packagesToInstall.includes(pkg)) {
              packagesToInstall.push(pkg);
            }
          });
        }

        // Parse files from generated code
        const fileRegex = /<file path="([^"]+)">([\s\S]*?)<\/file>/g;
        const files: Array<{ path: string; content: string }> = [];
        let match;

        while ((match = fileRegex.exec(generatedCode)) !== null) {
          files.push({ path: match[1], content: match[2].trim() });
        }

        // Track edit in conversation history
        if (isEdit && editContext && global.conversationState) {
          const editRecord: ConversationEdit = {
            timestamp: Date.now(),
            userRequest: prompt,
            editType: editContext.editIntent.type,
            targetFiles: editContext.primaryFiles,
            confidence: editContext.editIntent.confidence,
            outcome: 'success',
          };
          global.conversationState.context.edits.push(editRecord);
        }

        // Update last message with edited files
        const lastMsg = global.conversationState?.context.messages[
          global.conversationState.context.messages.length - 1
        ];
        if (lastMsg && files.length > 0) {
          lastMsg.metadata = {
            ...lastMsg.metadata,
            editedFiles: files.map(f => f.path),
          };
        }

        // Send completion
        await sendProgress({
          type: 'complete',
          generatedCode,
          files: files.length,
          components: componentCount,
          model,
          packagesToInstall: packagesToInstall.length > 0 ? packagesToInstall : undefined,
        } as StreamEvent);

      } catch (error) {
        console.error('[generate-ai-code-stream] Stream processing error:', error);
        await sendProgress({
          type: 'error',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        await close();
      }
    })();

    // Return the stream with proper headers
    return new Response(stream, {
      headers: getSSEHeaders(),
    });

  } catch (error) {
    console.error('[generate-ai-code-stream] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
