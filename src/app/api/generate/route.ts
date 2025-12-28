import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import * as Sentry from '@sentry/nextjs';
import { generateCode } from '@/agents/agents/code-generation';
import { runValidation } from '@/agents/agents/validation';
import { fixErrors } from '@/agents/agents/error-fixer';
import { sandboxManager } from '@/agents/sandbox';
import type { StreamUpdate, Framework } from '@/agents/types';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

// Lazy initialization to avoid build-time errors when env var is not set
let _convex: ConvexHttpClient | null = null;
function getConvex(): ConvexHttpClient {
  if (!_convex) {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) {
      throw new Error('NEXT_PUBLIC_CONVEX_URL is not set');
    }
    _convex = new ConvexHttpClient(url);
  }
  return _convex;
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const convex = getConvex();
  try {
    const creditResult = await convex.mutation(api.usage.checkAndConsumeCreditForUser, {
      userId,
    });
    
    if (!creditResult.success) {
      return new Response(
        JSON.stringify({ 
          error: 'Insufficient credits', 
          message: creditResult.message,
          remaining: creditResult.remaining 
        }), 
        { 
          status: 402,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  } catch (error) {
    console.error('Failed to check credits:', error);
    return new Response('Failed to verify credits', { status: 500 });
  }

  const body = await request.json();
  const { projectId, prompt, model, sandboxId: providedSandboxId, messageId } = body;

  if (!projectId || !prompt) {
    return new Response('Missing required fields', { status: 400 });
  }

  // Validate sandboxId format if provided
  const sandboxId = providedSandboxId;
  if (sandboxId) {
    if (typeof sandboxId !== 'string' || sandboxId.trim() === '') {
      return new Response('Invalid sandboxId: must be a non-empty string', { status: 400 });
    }

    const sandboxIdPattern = /^[a-zA-Z0-9_-]+$/;
    if (!sandboxIdPattern.test(sandboxId)) {
      return new Response('Invalid sandboxId: must contain only alphanumeric characters, hyphens, and underscores', { status: 400 });
    }
  }

  Sentry.setUser({ id: userId });
  Sentry.setTag('project_id', projectId);

  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const sendUpdate = async (update: StreamUpdate) => {
    const message = `data: ${JSON.stringify(update)}\n\n`;
    await writer.write(encoder.encode(message));
  };

  (async () => {
    try {
      let assistantMessageId: Id<'messages'>;

      const convex = getConvex();
      
      if (messageId) {
        assistantMessageId = messageId as Id<'messages'>;
      } else {
        const newMessageId = await convex.mutation(api.messages.createForUser, {
          userId,
          projectId: projectId as Id<'projects'>,
          content: '',
          role: 'ASSISTANT',
          type: 'STREAMING',
          status: 'STREAMING',
        });
        assistantMessageId = newMessageId as Id<'messages'>;
      }

      const project = await convex.query(api.projects.getForSystem, {
        projectId: projectId as Id<'projects'>,
      });

      let effectiveSandboxId = sandboxId;
      if (!effectiveSandboxId) {
        const frameworkMap: Record<string, Framework> = {
          'NEXTJS': 'nextjs',
          'REACT': 'react',
          'VUE': 'vue',
          'ANGULAR': 'angular',
          'SVELTE': 'svelte',
        };
        const framework = frameworkMap[project?.framework || 'NEXTJS'] || 'nextjs';
        await sendUpdate({ type: 'status', message: 'Creating sandbox...' });
        const sandbox = await sandboxManager.create(framework);
        effectiveSandboxId = sandbox.sandboxId;
      }

      const result = await generateCode(
        {
          projectId,
          sandboxId: effectiveSandboxId,
          prompt,
          model: model || 'auto',
        },
        sendUpdate
      );

      await sendUpdate({ type: 'status', message: 'Validating code...' });
      let validation = await runValidation(effectiveSandboxId);

      if (!validation.success) {
        await sendUpdate({ type: 'status', message: 'Fixing errors...' });
        validation = await fixErrors(effectiveSandboxId, validation.errors || [], 0, sendUpdate);
      }

      const framework = (project?.framework || 'NEXTJS') as 'NEXTJS' | 'ANGULAR' | 'REACT' | 'VUE' | 'SVELTE';

      await convex.mutation(api.messages.createFragmentForUser, {
        userId,
        messageId: assistantMessageId,
        sandboxId: effectiveSandboxId,
        sandboxUrl: `https://${effectiveSandboxId}.e2b.dev`,
        title: result.summary.slice(0, 100),
        files: result.files,
        framework,
      });

      await convex.mutation(api.messages.updateMessage, {
        messageId: assistantMessageId,
        content: result.summary,
        status: 'COMPLETE',
      });

      await sendUpdate({
        type: 'complete',
        message: result.summary,
        files: result.files,
      });
    } catch (error) {
      Sentry.captureException(error);
      await sendUpdate({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      await writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
