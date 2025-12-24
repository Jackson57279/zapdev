import { NextRequest, NextResponse } from 'next/server';
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { SandboxState } from '@/types/sandbox';

// Initialize Convex client
let convexClient: ConvexHttpClient | null = null;
function getConvexClient() {
  if (!convexClient) {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) {
      throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is not set");
    }
    convexClient = new ConvexHttpClient(url);
  }
  return convexClient;
}

const convex = new Proxy({} as ConvexHttpClient, {
  get(_target, prop) {
    return getConvexClient()[prop as keyof ConvexHttpClient];
  },
});

declare global {
  var sandboxState: SandboxState;
}

interface FileUpdate {
  path: string;
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    const { generatedCode, projectId, userMessage, model } = await request.json();
    
    console.log('[apply-ai-code-stream] Received application request');
    console.log('[apply-ai-code-stream] - projectId:', projectId);
    console.log('[apply-ai-code-stream] - model:', model);
    console.log('[apply-ai-code-stream] - userMessage length:', userMessage?.length);
    console.log('[apply-ai-code-stream] - generatedCode length:', generatedCode?.length);
    
    if (!generatedCode || !projectId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Generated code and projectId are required' 
      }, { status: 400 });
    }

    // Get project from Convex
    const project = await convex.query(api.projects.getForSystem, {
      projectId: projectId as Id<"projects">,
    });

    if (!project) {
      return NextResponse.json({ 
        success: false, 
        error: 'Project not found' 
      }, { status: 404 });
    }

    // Parse the generated code
    console.log('[apply-ai-code-stream] Parsing generated code...');
    
    // Extract files
    const fileRegex = /<file path="([^"]+)">([\s\S]*?)<\/file>/g;
    const files: FileUpdate[] = [];
    let match;
    
    while ((match = fileRegex.exec(generatedCode)) !== null) {
      const filePath = match[1];
      let content = match[2].trim();
      
      // Remove markdown code blocks if present
      content = content.replace(/^```[a-z]*\n?/gm, '').replace(/\n?```$/gm, '');
      
      files.push({ path: filePath, content });
    }
    
    console.log('[apply-ai-code-stream] Found', files.length, 'files to update');
    
    // Extract packages to install
    const installRegex = /<install>([\s\S]*?)<\/install>/;
    const installMatch = generatedCode.match(installRegex);
    let packagesToInstall: string[] = [];
    
    if (installMatch) {
      packagesToInstall = installMatch[1]
        .trim()
        .split('\n')
        .map((line: string) => line.trim())
        .filter((line: string) => line && !line.startsWith('#'));
      console.log('[apply-ai-code-stream] Packages to install:', packagesToInstall);
    }
    
    // Extract commands to run
    const commandRegex = /<command>([\s\S]*?)<\/command>/g;
    const commands: string[] = [];
    let commandMatch;
    
    while ((commandMatch = commandRegex.exec(generatedCode)) !== null) {
      const command = commandMatch[1].trim();
      if (command) {
        commands.push(command);
      }
    }
    
    console.log('[apply-ai-code-stream] Commands to run:', commands);
    
    // Extract explanation
    const explanationMatch = generatedCode.match(/<explanation>([\s\S]*?)<\/explanation>/);
    const explanation = explanationMatch ? explanationMatch[1].trim() : 'Code generated successfully!';
    
    // Get the sandbox from global state
    // In production, this would be managed through E2B or another provider
    console.log('[apply-ai-code-stream] Checking for active sandbox...');

    // Get the sandbox instance from global state
    const sandbox = global.sandboxState?.sandbox;
    
    if (!sandbox) {
      return NextResponse.json({ 
        success: false, 
        error: 'Sandbox not available. Please refresh and try again.',
        needsSandbox: true
      }, { status: 400 });
    }

    // Apply the changes to the sandbox
    console.log('[apply-ai-code-stream] Applying changes to sandbox...');
    
    // 1. Install packages if needed
    if (packagesToInstall.length > 0) {
      console.log('[apply-ai-code-stream] Installing packages...');
      try {
        const installCommand = `bun install ${packagesToInstall.join(' ')}`;
        const installResult = await sandbox.commands.run(installCommand);
        console.log('[apply-ai-code-stream] Install output:', installResult.stdout);
        
        if (installResult.exitCode !== 0) {
          console.error('[apply-ai-code-stream] Install failed:', installResult.stderr);
        }
      } catch (error) {
        console.error('[apply-ai-code-stream] Error installing packages:', error);
      }
    }
    
    // 2. Write files to sandbox
    console.log('[apply-ai-code-stream] Writing files...');
    const fileResults = await Promise.all(
      files.map(async (file) => {
        try {
          await sandbox.files.write(file.path, file.content);
          console.log('[apply-ai-code-stream] Wrote file:', file.path);
          
          // Update file cache in global state
          if (global.sandboxState?.fileCache?.files) {
            global.sandboxState.fileCache.files[file.path] = file.content;
          }
          
          return { path: file.path, success: true };
        } catch (error) {
          console.error(`[apply-ai-code-stream] Error writing file ${file.path}:`, error);
          return { path: file.path, success: false, error: (error as Error).message };
        }
      })
    );
    
    const successfulWrites = fileResults.filter(r => r.success).length;
    console.log('[apply-ai-code-stream] Successfully wrote', successfulWrites, 'files');
    
    // 3. Run additional commands
    const commandResults = [];
    for (const command of commands) {
      try {
        console.log('[apply-ai-code-stream] Running command:', command);
        const result = await sandbox.commands.run(command);
        commandResults.push({
          command,
          exitCode: result.exitCode,
          stdout: result.stdout,
          stderr: result.stderr,
        });
        console.log('[apply-ai-code-stream] Command result:', result.exitCode);
      } catch (error) {
        console.error('[apply-ai-code-stream] Error running command:', error);
        commandResults.push({
          command,
          error: (error as Error).message,
        });
      }
    }
    
    // 4. Run validation (lint and build) with auto-fix retry
    console.log('[apply-ai-code-stream] Running validation...');
    let lintResult = { exitCode: 0, stdout: '', stderr: '' };
    let buildResult = { exitCode: 0, stdout: '', stderr: '' };
    let validationPassed = false;
    let autoFixAttempts = 0;
    const maxAutoFixAttempts = 2;
    
    try {
      console.log('[apply-ai-code-stream] Running lint...');
      lintResult = await sandbox.commands.run('bun run lint');
      console.log('[apply-ai-code-stream] Lint exit code:', lintResult.exitCode);
      
      if (lintResult.exitCode === 0) {
        console.log('[apply-ai-code-stream] Running build...');
        buildResult = await sandbox.commands.run('bun run build');
        console.log('[apply-ai-code-stream] Build exit code:', buildResult.exitCode);
      }
      
      validationPassed = lintResult.exitCode === 0 && buildResult.exitCode === 0;
      
      // Auto-fix logic: if validation failed and we have errors, attempt to fix
      while (!validationPassed && autoFixAttempts < maxAutoFixAttempts) {
        autoFixAttempts++;
        console.log(`[apply-ai-code-stream] Auto-fix attempt ${autoFixAttempts}/${maxAutoFixAttempts}`);
        
        const validationErrors = [
          lintResult.exitCode !== 0 ? `Lint Errors:\n${lintResult.stderr || lintResult.stdout}` : '',
          buildResult.exitCode !== 0 ? `Build Errors:\n${buildResult.stderr || buildResult.stdout}` : '',
        ].filter(Boolean).join('\n\n');
        
        if (!validationErrors) break;
        
        console.log('[apply-ai-code-stream] Validation errors detected, attempting auto-fix...');
        
        // Call generate-ai-code-stream again with error context for auto-fix
        const autoFixPrompt = `Please fix the following validation errors in the code:\n\n${validationErrors}\n\nOnly output the corrected files using the same <file> format. Do not regenerate the entire application.`;
        
        const autoFixResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/generate-ai-code-stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            projectId,
            prompt: autoFixPrompt,
            model,
            isEdit: true,
          }),
        });
        
        if (!autoFixResponse.ok) {
          console.error('[apply-ai-code-stream] Auto-fix stream failed');
          break;
        }
        
        // Process the auto-fix stream
        const reader = autoFixResponse.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let autoFixCode = '';
        
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6));
                  if (data.type === 'complete' && data.generatedCode) {
                    autoFixCode = data.generatedCode;
                  }
                } catch (e) {
                  // Ignore parse errors
                }
              }
            }
          }
        }
        
        if (!autoFixCode) {
          console.error('[apply-ai-code-stream] No auto-fix code generated');
          break;
        }
        
        // Apply auto-fix files
        const autoFixFileRegex = /<file path="([^"]+)">([\s\S]*?)<\/file>/g;
        let autoFixMatch;
        const autoFixFiles = [];
        
        while ((autoFixMatch = autoFixFileRegex.exec(autoFixCode)) !== null) {
          const filePath = autoFixMatch[1];
          let content = autoFixMatch[2].trim();
          content = content.replace(/^```[a-z]*\n?/gm, '').replace(/\n?```$/gm, '');
          autoFixFiles.push({ path: filePath, content });
        }
        
        console.log(`[apply-ai-code-stream] Applying ${autoFixFiles.length} auto-fix files`);
        
        for (const file of autoFixFiles) {
          try {
            await sandbox.files.write(file.path, file.content);
            if (global.sandboxState?.fileCache?.files) {
              global.sandboxState.fileCache.files[file.path] = file.content;
            }
          } catch (error) {
            console.error(`[apply-ai-code-stream] Error writing auto-fix file ${file.path}:`, error);
          }
        }
        
        // Re-run validation
        console.log('[apply-ai-code-stream] Re-running validation after auto-fix...');
        lintResult = await sandbox.commands.run('bun run lint');
        console.log('[apply-ai-code-stream] Post-fix lint exit code:', lintResult.exitCode);
        
        if (lintResult.exitCode === 0) {
          buildResult = await sandbox.commands.run('bun run build');
          console.log('[apply-ai-code-stream] Post-fix build exit code:', buildResult.exitCode);
        }
        
        validationPassed = lintResult.exitCode === 0 && buildResult.exitCode === 0;
        
        if (validationPassed) {
          console.log(`[apply-ai-code-stream] Auto-fix successful on attempt ${autoFixAttempts}`);
          break;
        }
      }
    } catch (error) {
      console.error('[apply-ai-code-stream] Validation error:', error);
    }
    
    console.log('[apply-ai-code-stream] Final validation passed:', validationPassed);
    
    // 5. Save to Convex
    console.log('[apply-ai-code-stream] Saving to Convex...');
    
    // Create user message if provided
    let userMessageId = null;
    if (userMessage) {
      userMessageId = await convex.mutation(api.messages.create, {
        projectId: projectId as Id<"projects">,
        content: userMessage,
        role: "USER",
        type: "RESULT",
        status: "COMPLETE",
      });
      console.log('[apply-ai-code-stream] Created user message:', userMessageId);
    }
    
    // Create assistant message with the generated code and files metadata
    const assistantMessageId = await convex.mutation(api.messages.create, {
      projectId: projectId as Id<"projects">,
      content: explanation || `Generated ${files.length} files successfully`,
      role: "ASSISTANT",
      type: "RESULT",
      status: "COMPLETE",
    });
    console.log('[apply-ai-code-stream] Created assistant message:', assistantMessageId);
    console.log(`[apply-ai-code-stream] Message includes ${files.length} files:`, files.map(f => f.path));
    
    // Note: In the original system, fragments would be created here
    // For now, files are stored in the sandbox and the message content includes the explanation
    const successfulFragments = files.length;
    
    return NextResponse.json({ 
      success: true,
      messageId: assistantMessageId,
      filesWritten: successfulWrites,
      filesGenerated: successfulFragments,
      validationPassed,
      autoFixAttempts,
      lintExitCode: lintResult.exitCode,
      buildExitCode: buildResult.exitCode,
      lintOutput: lintResult.stderr || lintResult.stdout,
      buildOutput: buildResult.stderr || buildResult.stdout,
    });
    
  } catch (error) {
    console.error('[apply-ai-code-stream] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}

