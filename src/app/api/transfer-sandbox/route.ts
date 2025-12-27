import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fragmentId } = body;

    if (!fragmentId) {
      return NextResponse.json(
        { error: "Fragment ID is required" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Sandbox transfer not yet implemented in new architecture",
    });
  } catch (error) {
    console.error("[ERROR] Failed to resume sandbox:", error);
    return NextResponse.json(
      { error: "Failed to resume sandbox" },
      { status: 500 }
    );
  }
}
