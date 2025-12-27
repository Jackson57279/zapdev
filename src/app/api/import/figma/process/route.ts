import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth-server";

export const dynamic = "force-dynamic";

export async function POST(_request: Request) {
  const stackUser = await getUser();
  if (!stackUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!stackUser.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // TODO: Re-implement Figma import with new AI SDK agent
  console.warn("[figma/process] Feature temporarily unavailable during migration");
  
  return NextResponse.json(
    { 
      error: "Figma import feature is temporarily unavailable. Please try again later.",
      code: "FEATURE_UNAVAILABLE"
    },
    { status: 503 }
  );
}
