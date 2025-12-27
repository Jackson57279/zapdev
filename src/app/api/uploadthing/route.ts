import { createRouteHandler } from "uploadthing/next";

import { ourFileRouter } from "@/lib/uploadthing";

import type { NextRequest } from "next/server";

const uploadthingHandler = createRouteHandler({
  router: ourFileRouter,
  config: {
    token: process.env.UPLOADTHING_TOKEN,
  },
});

type UploadthingRouteContext = { params: Promise<Record<string, never>> };

export const GET = (
  request: NextRequest,
  _context: UploadthingRouteContext,
) =>
  uploadthingHandler.GET(
    request as unknown as Parameters<typeof uploadthingHandler.GET>[0],
  );

export const POST = (
  request: NextRequest,
  _context: UploadthingRouteContext,
) =>
  uploadthingHandler.POST(
    request as unknown as Parameters<typeof uploadthingHandler.POST>[0],
  );
