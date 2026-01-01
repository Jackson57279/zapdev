import { NextResponse } from "next/server";

export async function POST(_request: Request) {
  return NextResponse.json(
    { error: "Sandbox transfer is no longer needed. Code now runs in WebContainer on your browser." },
    { status: 410 }
  );
}

export const maxDuration = 60;
