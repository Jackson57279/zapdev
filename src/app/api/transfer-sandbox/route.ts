import { NextResponse } from "next/server";

export async function POST(_request: Request) {
  return NextResponse.json(
    {
      error:
        "Sandbox transfer is not supported with the WebContainer backend. " +
        "Please regenerate the fragment to start a new preview.",
    },
    { status: 501 }
  );
}

export const maxDuration = 60;
