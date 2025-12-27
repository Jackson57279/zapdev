import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getPolarClient, getPolarProProductId, isPolarConfigured } from "@/lib/polar-client";

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

    const body = await request.json();
    const { 
      productId = getPolarProProductId(),
      successUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?subscription=success`,
      cancelUrl: _cancelUrl = `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=true`
    } = body;
    void _cancelUrl; // Unused but kept for API compatibility

    const polar = getPolarClient();

    const checkout = await polar.checkouts.create({
      products: [productId],
      successUrl,
      metadata: {
        userId,
      },
    });

    return NextResponse.json({
      checkoutId: checkout.id,
      url: checkout.url,
    });
  } catch (error) {
    console.error("❌ Polar checkout error:", error);
    
    const message = error instanceof Error ? error.message : "Failed to create checkout";
    const status = message.includes("401") || message.includes("invalid_token") ? 401 : 500;
    
    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}

