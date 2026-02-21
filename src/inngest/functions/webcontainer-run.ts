import { ConvexHttpClient } from "convex/browser";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { inngest } from "../client";

let convexClient: ConvexHttpClient | null = null;

const getConvexClient = (): ConvexHttpClient => {
  if (convexClient) {
    return convexClient;
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is not set");
  }

  convexClient = new ConvexHttpClient(convexUrl);
  return convexClient;
};

export const enqueueWebContainerRunFunction = inngest.createFunction(
  { id: "enqueue-webcontainer-run" },
  { event: "agent/code-webcontainer.run" },
  async ({ event }) => {
    const convex = getConvexClient();
    const projectId = event.data.projectId as Id<"projects">;

    await convex.query(api.projects.getForSystem, {
      projectId,
    });

    const runId = await convex.mutation(api.agentRuns.enqueueForSystem, {
      projectId,
      value: event.data.value,
      model: event.data.model,
      framework: event.data.framework,
    });

    return {
      ok: true,
      runId,
      projectId,
    };
  }
);
