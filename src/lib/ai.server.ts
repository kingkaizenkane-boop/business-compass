/**
 * Server-only access to the Lovable AI Gateway.
 * No AI keys ever reach the client — this module is blocked from client bundles.
 */

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatJsonResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: string; retryable: boolean };

function parseJsonLoose<T>(raw: string): T | null {
  const cleaned = raw
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Calls the gateway and returns a detailed result so callers can surface the real
 * cause (credits, rate limit, truncated output) instead of a generic failure.
 * Retries once on 429/5xx, and once more with a bigger output budget when the
 * model truncated its JSON.
 */
export async function chatJsonResult<T>(options: {
  messages: ChatMessage[];
  model?: string;
  maxTokens?: number;
}): Promise<ChatJsonResult<T>> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) {
    console.error("[ai] LOVABLE_API_KEY missing");
    return { ok: false, reason: "AI is not configured for this project.", retryable: false };
  }

  const model = options.model ?? "google/gemini-2.5-flash";
  let maxTokens = options.maxTokens ?? 4000;
  let lastReason = "The AI service did not return a usable response.";
  let lastRetryable = true;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({
          model,
          messages: options.messages,
          response_format: { type: "json_object" },
          max_tokens: maxTokens,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        console.error("[ai] gateway error", response.status, body.slice(0, 800));
        if (response.status === 429) {
          lastReason = "The AI service is rate limited right now. Please try again in a moment.";
          lastRetryable = true;
        } else if (response.status === 402) {
          return {
            ok: false,
            reason: "This workspace has run out of AI credits. Add credits in Lovable to continue.",
            retryable: false,
          };
        } else if (response.status === 403) {
          return {
            ok: false,
            reason: "AI usage is blocked by workspace policy or a credit limit.",
            retryable: false,
          };
        } else if (response.status >= 500) {
          lastReason = "The AI service had a temporary upstream failure.";
          lastRetryable = true;
        } else {
          return {
            ok: false,
            reason: `The AI request was rejected (${response.status}).`,
            retryable: false,
          };
        }
        if (lastRetryable && attempt < 2) {
          const retryAfter = Number(response.headers.get("retry-after") ?? 0);
          await new Promise((r) => setTimeout(r, Math.max(retryAfter * 1000, 800 * (attempt + 1))));
          continue;
        }
        return { ok: false, reason: lastReason, retryable: lastRetryable };
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
      };
      const choice = payload.choices?.[0];
      const content = choice?.message?.content;
      const finish = choice?.finish_reason;

      if (!content || content.trim() === "") {
        console.error("[ai] empty content", { finish, maxTokens });
        // Reasoning/verbose models can spend the whole budget before emitting text.
        maxTokens = Math.min(maxTokens * 2, 16000);
        lastReason = "The AI ran out of output space before answering.";
        continue;
      }

      const parsed = parseJsonLoose<T>(content);
      if (parsed === null) {
        console.error("[ai] unparseable content", { finish, sample: content.slice(0, 400) });
        if (finish === "length") {
          maxTokens = Math.min(maxTokens * 2, 16000);
          lastReason = "The AI answer was cut off before it was complete.";
          continue;
        }
        return {
          ok: false,
          reason: "The AI returned a malformed response. Please try again.",
          retryable: true,
        };
      }

      return { ok: true, data: parsed };
    } catch (error) {
      console.error("[ai] request failed", error);
      lastReason = "The AI request could not be completed.";
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        continue;
      }
    }
  }

  return { ok: false, reason: lastReason, retryable: lastRetryable };
}

/** Back-compat helper: returns null on any failure. */
export async function chatJson<T>(options: {
  messages: ChatMessage[];
  model?: string;
  maxTokens?: number;
}): Promise<T | null> {
  const result = await chatJsonResult<T>(options);
  return result.ok ? result.data : null;
}
