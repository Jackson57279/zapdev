import { usageRouter } from '@/modules/usage/server/procedures';
import { messagesRouter } from '@/modules/messages/server/procedures';
import { projectsRouter } from '@/modules/projects/server/procedures';
import { sandboxRouter } from '@/modules/sandbox/server/procedures';
import { skillsRouter } from '@/modules/skills/server/procedures';

import { createTRPCRouter } from '../init';

export const appRouter = createTRPCRouter({
  usage: usageRouter,
  messages: messagesRouter,
  projects: projectsRouter,
  sandbox: sandboxRouter,
  skills: skillsRouter,
});
// export type definition of API
export type AppRouter = typeof appRouter;
