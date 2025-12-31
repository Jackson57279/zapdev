import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getPolarClient,
  isPolarConfigured,
} from "@/lib/polar";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export async function POST(request: NextRequest) {
  try {
    if (!isPolarConfigured()) {
      return NextResponse.json(
        { error: "Polar.sh is not configured" },
        { status: 503 }
      );
    }

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

    // Get Polar customer ID for this user
    const polarCustomerId = await convex.query(
      api.polar.getCustomerIdByUserId,
      { userId }
    );

    if (!polarCustomerId) {
      return NextResponse.json(
        { error: "No Polar customer found for this user" },
        { status: 404 }
      );
    }

    const polar = getPolarClient();

    // Create customer portal session
    const session = await polar.customerSessions.create({
      customerId: polarCustomerId,
      returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?portal=return`,
    });

    return NextResponse.json({
      customerPortalUrl: session.customerPortalUrl,
      session: {
        id: session.id,
        expiresAt: session.expiresAt,
      },
    });
  } catch (error) {
    console.error("❌ Polar customer portal error:", error);

    const message = error instanceof Error ? error.message : "Failed to create customer portal session";
    const status = message.includes("401") || message.includes("invalid_token") ? 401 : 500;

    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}
