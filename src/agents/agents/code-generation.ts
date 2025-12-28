import { Agent } from '@ai-sdk-tools/agents';
import { getModel, ModelId } from '../client';
import { sandboxManager } from '../sandbox';
import { withRetry, retryOnTransient } from '../retry';
import { createLogger } from '../logger';
import { createTools } from '../tools';
import { getFrameworkPrompt } from '../prompts';
import type { Framework, GenerationRequest, StreamUpdate } from '../types';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

let _convex: ConvexHttpClient | null = null;
function getConvex(): ConvexHttpClient {
  if (!_convex) {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) throw new Error('NEXT_PUBLIC_CONVEX_URL is not set');
    _convex = new ConvexHttpClient(url);
  }
  return _convex;
}

interface GenerationResult {
  summary: string;
  files: Record<string, string>;
}

export async function generateCode(
  request: GenerationRequest,
  onProgress: (update: StreamUpdate) => Promise<void>
): Promise<GenerationResult> {
  const logger = createLogger(request.projectId, {
    model: request.model,
    sandboxId: request.sandboxId,
  });

  logger.progress('init', 'Starting code generation');
  await onProgress({ type: 'status', message: 'Initializing AI agent...' });

  let sandbox;
  try {
    sandbox = await logger.startSpan('sandbox-connect', () =>
      sandboxManager.connect(request.sandboxId)
    );
  } catch (error) {
    const errorMessage = `Failed to connect to sandbox: ${error instanceof Error ? error.message : 'Unknown error'}`;
    logger.error(errorMessage, { error });
    throw new Error(errorMessage);
  }

  const project = await getConvex().query(api.projects.getForSystem, {
    projectId: request.projectId as Id<'projects'>,
  });
  const framework = (project?.framework?.toLowerCase() || 'nextjs') as Framework;

  logger.progress('framework', `Using framework: ${framework}`);
  await onProgress({ type: 'status', message: `Configuring for ${framework}...` });

  const files: Record<string, string> = {};
  const tools = createTools(sandbox, (path) => {
    onProgress({ type: 'file', filePath: path });
  });

  logger.progress('ai', 'Starting AI generation');
  await onProgress({ type: 'status', message: 'Generating code...' });

  let model;
  try {
    model = getModel(request.model as ModelId);
  } catch (error) {
    const errorMessage = `Failed to initialize AI model: ${error instanceof Error ? error.message : 'Unknown error'}`;
    logger.error(errorMessage, { error });
    throw new Error(errorMessage);
  }

  const codeAgent = new Agent({
    name: 'Code Generator',
    model,
    instructions: getFrameworkPrompt(framework),
    tools,
    maxTurns: 15,
    temperature: 0.7,
    onEvent: async (event) => {
      if (event.type === 'agent-step' && event.step.toolCalls) {
        for (const call of event.step.toolCalls) {
          console.log('[AI] Tool call:', call.toolName);
          if (call.toolName === 'createOrUpdateFiles' && 'args' in call && call.args) {
            const args = call.args as { files: Array<{ path: string; content: string }> };
            for (const file of args.files) {
              files[file.path] = file.content;
            }
          }
        }
      }
    },
  });

  const conversationHistory = request.conversationHistory || [];
  const prompt = request.prompt;

  const result = await withRetry(
    async () => {
      const messages = [
        ...conversationHistory,
        { role: 'user' as const, content: prompt },
      ];

      const response = codeAgent.stream({ messages });

      let fullText = '';
      for await (const textPart of response.textStream) {
        process.stdout.write(textPart);
        fullText += textPart;
        await onProgress({
          type: 'stream',
          content: textPart,
        });
      }
      
      console.log('\n[AI] Stream complete');
      
      const text = await response.text;
      const steps = await response.steps;
      
      console.log('[AI] Total steps:', steps.length);
      let totalToolCalls = 0;
      for (const step of steps) {
        if (step.toolCalls) {
          totalToolCalls += step.toolCalls.length;
          for (const call of step.toolCalls) {
            if (call.toolName === 'createOrUpdateFiles' && 'args' in call && call.args) {
              const args = call.args as { files: Array<{ path: string; content: string }> };
              for (const file of args.files) {
                files[file.path] = file.content;
              }
            }
          }
        }
      }
      console.log('[AI] Total tool calls:', totalToolCalls);
      console.log('[AI] Files generated:', Object.keys(files).length);

      return { text: text || fullText, files };
    },
    {
      maxAttempts: 3,
      retryIf: retryOnTransient,
    }
  );

  const summary = extractSummary(result.text);

  logger.progress('complete', 'Code generation finished');
  await onProgress({
    type: 'complete',
    message: summary,
    files,
  });

  logger.complete({ filesCount: Object.keys(files).length });

  return { summary, files };
}

function extractSummary(text: string): string {
  const summaryMatch = text.match(/<task_summary>([\s\S]*?)<\/task_summary>/);
  if (summaryMatch) {
    return summaryMatch[1].trim();
  }

  const firstParagraph = text.split('\n\n')[0];
  return firstParagraph?.slice(0, 200) || 'Code generation completed';
}
