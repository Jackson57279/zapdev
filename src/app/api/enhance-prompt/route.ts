import { NextRequest, NextResponse } from "next/server";

const ENHANCE_PROMPT_SYSTEM = `You are an expert prompt engineer specializing in software development requests. Your task is to enhance user prompts to make them more effective for AI code generation.

When enhancing a prompt, you should:

1. **Preserve Intent**: Keep the core request and user's vision intact
2. **Add Specificity**: Include technical details, frameworks, and implementation approaches
3. **Clarify Ambiguity**: Resolve vague requirements with sensible defaults
4. **Add Context**: Include relevant best practices and patterns
5. **Structure Better**: Organize requirements in a clear, actionable format
6. **Be Concise**: Enhance without making it overly verbose

Guidelines:
- If a UI is mentioned, specify modern design principles (responsive, accessible, clean)
- For web apps, assume modern stack unless specified (React/Next.js, TypeScript, Tailwind)
- Include data structure suggestions when relevant
- Mention error handling and edge cases when appropriate
- Keep the enhanced prompt under 500 words
- Maintain a natural, conversational tone

Example transformations:
- "make a todo app" → "Create a modern todo application with a clean, responsive UI using React and TypeScript. Include features for adding, editing, deleting, and marking tasks as complete. Use local storage for persistence. Implement proper form validation and error handling. Style with Tailwind CSS for a polished look."

- "build a dashboard" → "Build an analytics dashboard with a modern, professional design. Include key metrics cards, interactive charts (line, bar, pie), and data tables. Make it responsive for mobile and desktop. Use a clean color scheme with proper spacing. Implement loading states and error handling for data fetching."

Return ONLY the enhanced prompt text, nothing else. Do not add explanations, notes, or meta-commentary.`;

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    if (prompt.length > 5000) {
      return NextResponse.json(
        { error: "Prompt is too long (max 5000 characters)" },
        { status: 400 }
      );
    }

    const apiKey = process.env.AI_GATEWAY_API_KEY;
    const baseUrl = process.env.AI_GATEWAY_BASE_URL || "https://ai-gateway.vercel.sh/v1";

    if (!apiKey) {
      console.error("[ERROR] AI_GATEWAY_API_KEY not configured");
      return NextResponse.json(
        { error: "AI service not configured" },
        { status: 500 }
      );
    }

    console.log("[DEBUG] Enhancing prompt with length:", prompt.length);

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-5-nano",
        messages: [
          {
            role: "system",
            content: ENHANCE_PROMPT_SYSTEM,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[ERROR] AI Gateway error:", response.status, errorText);
      return NextResponse.json(
        { error: "Failed to enhance prompt" },
        { status: 500 }
      );
    }

    const data = await response.json();
    const enhancedPrompt = data.choices?.[0]?.message?.content?.trim();

    if (!enhancedPrompt) {
      console.error("[ERROR] No enhanced prompt in response:", data);
      return NextResponse.json(
        { error: "Failed to generate enhanced prompt" },
        { status: 500 }
      );
    }

    console.log("[DEBUG] Successfully enhanced prompt");

    return NextResponse.json({
      enhancedPrompt,
      originalLength: prompt.length,
      enhancedLength: enhancedPrompt.length,
    });
  } catch (error) {
    console.error("[ERROR] Enhance prompt error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
