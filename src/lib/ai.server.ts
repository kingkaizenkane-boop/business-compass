/**
 * Server-only access to the Lovable AI Gateway.
 * No AI keys ever reach the client — this module is blocked from client bundles.
 */

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function chatJson<T>(options: {
  messages: ChatMessage[];
  model?: string;
  maxTokens?: number;
}): Promise<T | null> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) {
    console.error("[ai] LOVABLE_API_KEY missing — skipping extraction");
    return null;
  }

  try {
    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: options.model ?? "google/gemini-2.5-flash",
        messages: options.messages,
        response_format: { type: "json_object" },
        max_tokens: options.maxTokens ?? 1200,
      }),
    });

    if (!response.ok) {
      console.error("[ai] gateway error", response.status, await response.text());
      return null;
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return null;

    const cleaned = content.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    return JSON.parse(cleaned) as T;
  } catch (error) {
    console.error("[ai] extraction failed", error);
    return null;
  }
}
