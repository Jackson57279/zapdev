import { fetchQuery } from "convex/nextjs";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fragmentId: string }> }
) {
  try {
    const { fragmentId } = await params;

    const fragment = await fetchQuery(api.messages.getFragmentById, {
      fragmentId: fragmentId as Id<"fragments">
    });

    if (!fragment) {
      return Response.json(
        { error: "Fragment not found" },
        { status: 404 }
      );
    }

    return Response.json(fragment);
  } catch (error) {
    console.error("[ERROR] Failed to fetch fragment:", error);
    return Response.json(
      { error: "Failed to fetch fragment" },
      { status: 500 }
    );
  }
}
