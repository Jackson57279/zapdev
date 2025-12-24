import { NextRequest, NextResponse } from 'next/server';
import { createGroq } from '@ai-sdk/groq';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { streamText } from 'ai';
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { SandboxState } from '@/types/sandbox';

// Import framework prompts from existing system
import {
  FRAMEWORK_SELECTOR_PROMPT,
  NEXTJS_PROMPT,
  ANGULAR_PROMPT,
  REACT_PROMPT,
  VUE_PROMPT,
  SVELTE_PROMPT,
} from "@/prompt";

// Force dynamic route to enable streaming
export const dynamic = 'force-dynamic';

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

// Check if we're using Vercel AI Gateway
const isUsingAIGateway = !!process.env.AI_GATEWAY_API_KEY;
const aiGatewayBaseURL = 'https://ai-gateway.vercel.sh/v1';

console.log('[generate-ai-code-stream] AI Gateway config:', {
  isUsingAIGateway,
  hasGroqKey: !!process.env.GROQ_API_KEY,
  hasAIGatewayKey: !!process.env.AI_GATEWAY_API_KEY
});

const groq = createGroq({
  apiKey: process.env.AI_GATEWAY_API_KEY ?? process.env.GROQ_API_KEY,
  baseURL: isUsingAIGateway ? aiGatewayBaseURL : undefined,
});

const anthropic = createAnthropic({
  apiKey: process.env.AI_GATEWAY_API_KEY ?? process.env.ANTHROPIC_API_KEY,
  baseURL: isUsingAIGateway ? aiGatewayBaseURL : (process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1'),
});

const googleGenerativeAI = createGoogleGenerativeAI({
  apiKey: process.env.AI_GATEWAY_API_KEY ?? process.env.GEMINI_API_KEY,
  baseURL: isUsingAIGateway ? aiGatewayBaseURL : undefined,
});

const openai = createOpenAI({
  apiKey: process.env.AI_GATEWAY_API_KEY ?? process.env.OPENAI_API_KEY,
  baseURL: isUsingAIGateway ? aiGatewayBaseURL : process.env.OPENAI_BASE_URL,
});

type Framework = 'nextjs' | 'angular' | 'react' | 'vue' | 'svelte';

function frameworkToConvexEnum(
  framework: Framework,
): "NEXTJS" | "ANGULAR" | "REACT" | "VUE" | "SVELTE" {
  const mapping: Record<
    Framework,
    "NEXTJS" | "ANGULAR" | "REACT" | "VUE" | "SVELTE"
  > = {
    nextjs: "NEXTJS",
    angular: "ANGULAR",
    react: "REACT",
    vue: "VUE",
    svelte: "SVELTE",
  };
  return mapping[framework];
}

function getFrameworkPrompt(framework: Framework): string {
  switch (framework) {
    case "nextjs":
      return NEXTJS_PROMPT;
    case "angular":
      return ANGULAR_PROMPT;
    case "react":
      return REACT_PROMPT;
    case "vue":
      return VUE_PROMPT;
    case "svelte":
      return SVELTE_PROMPT;
    default:
      return NEXTJS_PROMPT;
  }
}

declare global {
  var sandboxState: SandboxState;
}

export async function POST(request: NextRequest) {
  try {
    const { prompt, model = 'anthropic/claude-haiku-4.5', projectId, isEdit = false } = await request.json();
    
    console.log('[generate-ai-code-stream] Received request:');
    console.log('[generate-ai-code-stream] - prompt:', prompt);
    console.log('[generate-ai-code-stream] - isEdit:', isEdit);
    console.log('[generate-ai-code-stream] - projectId:', projectId);
    console.log('[generate-ai-code-stream] - model:', model);
    
    if (!prompt || !projectId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Prompt and projectId are required' 
      }, { status: 400 });
    }

    // Get project from Convex to get userId and framework
    const project = await convex.query(api.projects.getForSystem, {
      projectId: projectId as Id<"projects">,
    });

    if (!project) {
      return NextResponse.json({ 
        success: false, 
        error: 'Project not found' 
      }, { status: 404 });
    }

    // Determine framework
    let selectedFramework: Framework =
      (project.framework?.toLowerCase() as Framework) || "nextjs";

    // If project doesn't have a framework set, use framework selector
    if (!project.framework) {
      console.log("[generate-ai-code-stream] No framework set, running framework selector...");

      const frameworkSelectorModel = googleGenerativeAI("gemini-2.0-flash-lite");

      const frameworkResult = await streamText({
        model: frameworkSelectorModel,
        messages: [
          { role: "system", content: FRAMEWORK_SELECTOR_PROMPT },
          { role: "user", content: prompt }
        ],
        temperature: 0.3,
      });

      let frameworkText = "";
      for await (const textPart of frameworkResult.textStream) {
        frameworkText += textPart;
      }

      const detectedFramework = frameworkText.trim().toLowerCase();
      console.log("[generate-ai-code-stream] Framework selector output:", detectedFramework);

      if (
        ["nextjs", "angular", "react", "vue", "svelte"].includes(
          detectedFramework,
        )
      ) {
        selectedFramework = detectedFramework as Framework;
      }

      console.log("[generate-ai-code-stream] Selected framework:", selectedFramework);

      // Update project with selected framework
      await convex.mutation(api.projects.updateForUser, {
        userId: project.userId,
        projectId: projectId as Id<"projects">,
        framework: frameworkToConvexEnum(selectedFramework),
      });
    } else {
      console.log("[generate-ai-code-stream] Using existing framework:", selectedFramework);
    }

    // Load conversation history from Convex
    const previousMessages = await convex.query(api.messages.listForUser, {
      userId: project.userId,
      projectId: projectId as Id<"projects">,
    });

    // Take last few messages for context
    const recentMessages = previousMessages.slice(-5);
    console.log('[generate-ai-code-stream] Found', recentMessages.length, 'recent messages');
    
    // Create a stream for real-time updates
    const encoder = new TextEncoder();
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    
    // Function to send progress updates with flushing
    const sendProgress = async (data: any) => {
      const message = `data: ${JSON.stringify(data)}\n\n`;
      try {
        await writer.write(encoder.encode(message));
        // Force flush by writing a keep-alive comment
        if (data.type === 'stream' || data.type === 'conversation') {
          await writer.write(encoder.encode(': keepalive\n\n'));
        }
      } catch (error) {
        console.error('[generate-ai-code-stream] Error writing to stream:', error);
      }
    };
    
    // Start processing in background
    (async () => {
      try {
        // Send initial status
        await sendProgress({ type: 'status', message: 'Initializing AI...' });
        
        // Check if this is an edit mode (for auto-fix)
        let enhancedSystemPrompt = '';
        
        if (isEdit) {
          console.log('[generate-ai-code-stream] Edit mode detected (likely auto-fix)');
          await sendProgress({ type: 'status', message: '🔍 Analyzing errors...' });
          
          // For edit mode, we already have the full prompt with error context
          // Just use the framework prompt as the system context
        }
        
        // Build conversation context
        let conversationContext = '';
        if (recentMessages.length > 1) {
          conversationContext = `\n\n## Recent Conversation\n`;
          recentMessages.slice(0, -1).forEach(msg => {
            if (msg.role === 'USER') {
              const truncated = msg.content.length > 100 ? msg.content.substring(0, 100) + '...' : msg.content;
              conversationContext += `User: "${truncated}"\n`;
            }
          });
        }
        
        const frameworkPrompt = getFrameworkPrompt(selectedFramework);
        
        // Build system prompt
        let systemPrompt = frameworkPrompt + conversationContext;
        if (enhancedSystemPrompt) {
          systemPrompt = enhancedSystemPrompt + conversationContext;
        }

        await sendProgress({ type: 'status', message: 'Generating code...' });
        
        console.log('[generate-ai-code-stream] Starting streaming response with model:', model);
        
        // Determine which provider to use based on model
        const isAnthropic = model.startsWith('anthropic/');
        const isGoogle = model.startsWith('google/');
        const isOpenAI = model.startsWith('openai/');
        const modelProvider = isAnthropic ? anthropic : 
                              (isOpenAI ? openai : 
                              (isGoogle ? googleGenerativeAI : groq));
        
        // Fix model name transformation
        let actualModel: string;
        if (isAnthropic) {
          actualModel = model.replace('anthropic/', '');
        } else if (isOpenAI) {
          actualModel = model.replace('openai/', '');
        } else if (isGoogle) {
          actualModel = model.replace('google/', '');
        } else {
          actualModel = model;
        }

        console.log(`[generate-ai-code-stream] Using model: ${actualModel}`);

        // Build full prompt with context
        let fullPrompt = prompt;
        
        // Make streaming API call
        const result = await streamText({
          model: modelProvider(actualModel),
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: fullPrompt }
          ],
          temperature: 0.7,
        });
        
        // Stream the response
        let generatedCode = '';
        let currentFile = '';
        let currentFilePath = '';
        let componentCount = 0;
        let isInFile = false;
        
        for await (const textPart of result.textStream) {
          const text = textPart || '';
          generatedCode += text;
          currentFile += text;
          
          // Stream the raw text for live preview
          await sendProgress({ 
            type: 'stream', 
            text: text,
            raw: true 
          });
          
          // Check for file boundaries
          if (text.includes('<file path="')) {
            const pathMatch = text.match(/<file path="([^"]+)"/);
            if (pathMatch) {
              currentFilePath = pathMatch[1];
              isInFile = true;
              currentFile = text;
            }
          }
          
          // Check for file end
          if (isInFile && currentFile.includes('</file>')) {
            isInFile = false;
            
            // Send component progress update
            if (currentFilePath.includes('components/')) {
              componentCount++;
              const componentName = currentFilePath.split('/').pop()?.replace('.jsx', '') || 'Component';
              await sendProgress({ 
                type: 'component', 
                name: componentName,
                path: currentFilePath,
                index: componentCount
              });
            } else if (currentFilePath.includes('App.jsx')) {
              await sendProgress({ 
                type: 'app', 
                message: 'Generated main App.jsx',
                path: currentFilePath
              });
            }
            
            currentFile = '';
            currentFilePath = '';
          }
        }
        
        console.log('[generate-ai-code-stream] Streaming complete');
        
        // Parse files
        const fileRegex = /<file path="([^"]+)">([\s\S]*?)<\/file>/g;
        const files = [];
        let match;
        
        while ((match = fileRegex.exec(generatedCode)) !== null) {
          const filePath = match[1];
          const content = match[2].trim();
          files.push({ path: filePath, content });
        }
        
        // Extract explanation
        const explanationMatch = generatedCode.match(/<explanation>([\s\S]*?)<\/explanation>/);
        const explanation = explanationMatch ? explanationMatch[1].trim() : 'Code generated successfully!';
        
        // Send completion
        await sendProgress({ 
          type: 'complete', 
          generatedCode,
          explanation,
          files: files.length,
          components: componentCount,
          model,
        });
        
      } catch (error) {
        console.error('[generate-ai-code-stream] Stream processing error:', error);
        await sendProgress({ 
          type: 'error', 
          error: (error as Error).message 
        });
      } finally {
        await writer.close();
      }
    })();
    
    // Return the stream with proper headers for streaming support
    return new Response(stream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Transfer-Encoding': 'chunked',
        'Content-Encoding': 'none',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
    
  } catch (error) {
    console.error('[generate-ai-code-stream] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}

