import { NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import * as Sentry from '@sentry/nextjs';
import { generateCode } from '@/agents/agents/code-generation';
import { runValidation } from '@/agents/agents/validation';
import { fixErrors } from '@/agents/agents/error-fixer';
import type { StreamUpdate } from '@/agents/types';
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
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return new Response('Unauthorized', { status: 401 });
  }

  const plan = sessionClaims?.plan as string | undefined;
  if (plan !== 'pro') {
    return new Response('Pro plan required', { status: 402 });
  }

  const body = await request.json();
  const { projectId, prompt, model, sandboxId, messageId } = body;

  if (!projectId || !prompt) {
    return new Response('Missing required fields', { status: 400 });
  }

  if (!sandboxId || typeof sandboxId !== 'string' || sandboxId.trim() === '') {
    return new Response('Invalid sandboxId: must be a non-empty string', { status: 400 });
  }

  const sandboxIdPattern = /^[a-zA-Z0-9_-]+$/;
  if (!sandboxIdPattern.test(sandboxId)) {
    return new Response('Invalid sandboxId: must contain only alphanumeric characters, hyphens, and underscores', { status: 400 });
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

      const result = await generateCode(
        {
          projectId,
          sandboxId,
          prompt,
          model: model || 'auto',
        },
        sendUpdate
      );

      await sendUpdate({ type: 'status', message: 'Validating code...' });
      let validation = await runValidation(sandboxId);

      if (!validation.success) {
        await sendUpdate({ type: 'status', message: 'Fixing errors...' });
        validation = await fixErrors(sandboxId, validation.errors || [], 0, sendUpdate);
      }

      const framework = (project?.framework || 'NEXTJS') as 'NEXTJS' | 'ANGULAR' | 'REACT' | 'VUE' | 'SVELTE';

      await convex.mutation(api.messages.createFragmentForUser, {
        userId,
        messageId: assistantMessageId,
        sandboxId,
        sandboxUrl: `https://${sandboxId}.e2b.dev`,
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
