/**
 * Server-only access to the Lovable AI Gateway.
 * No AI keys ever reach the client — this module is blocked from client bundles.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { AI_MODELS, recordAiUsage, type TokenUsage, type UsageContext } from "./ai-usage.server";
import type { Database } from "@/integrations/supabase/types";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export type ChatJsonResult<T> =
  | { ok: true; data: T; usage: TokenUsage }
  | { ok: false; reason: string; retryable: boolean; usage: TokenUsage };

export type Accounting = {
  supabase: SupabaseClient<Database>;
  context: UsageContext;
};

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
  accounting?: Accounting;
}): Promise<ChatJsonResult<T>> {
  const totals: TokenUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  const finish = async (
    result:
      | { ok: true; data: T }
      | { ok: false; reason: string; retryable: boolean },
  ): Promise<ChatJsonResult<T>> => {
    if (options.accounting && totals.totalTokens > 0) {
      await recordAiUsage({
        supabase: options.accounting.supabase,
        context: options.accounting.context,
        model: options.model ?? AI_MODELS.planning,
        usage: totals,
        succeeded: result.ok,
      });
    }
    return { ...(result as object), usage: totals } as ChatJsonResult<T>;
  };

  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) {
    console.error("[ai] LOVABLE_API_KEY missing");
    return finish({ ok: false, reason: "AI is not configured for this project.", retryable: false });
  }

  const model = options.model ?? AI_MODELS.planning;
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
          return finish({
            ok: false,
            reason: "This workspace has run out of AI credits. Add credits in Lovable to continue.",
            retryable: false,
          });
        } else if (response.status === 403) {
          return finish({
            ok: false,
            reason: "AI usage is blocked by workspace policy or a credit limit.",
            retryable: false,
          });
        } else if (response.status >= 500) {
          lastReason = "The AI service had a temporary upstream failure.";
          lastRetryable = true;
        } else {
          return finish({
            ok: false,
            reason: `The AI request was rejected (${response.status}).`,
            retryable: false,
          });
        }
        if (lastRetryable && attempt < 2) {
          const retryAfter = Number(response.headers.get("retry-after") ?? 0);
          await new Promise((r) => setTimeout(r, Math.max(retryAfter * 1000, 800 * (attempt + 1))));
          continue;
        }
        return finish({ ok: false, reason: lastReason, retryable: lastRetryable });
      }

      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      };
      totals.promptTokens += payload.usage?.prompt_tokens ?? 0;
      totals.completionTokens += payload.usage?.completion_tokens ?? 0;
      totals.totalTokens +=
        payload.usage?.total_tokens ??
        (payload.usage?.prompt_tokens ?? 0) + (payload.usage?.completion_tokens ?? 0);
      const choice = payload.choices?.[0];
      const content = choice?.message?.content;
      const finishReason = choice?.finish_reason;

      if (!content || content.trim() === "") {
        console.error("[ai] empty content", { finishReason, maxTokens });
        // Reasoning/verbose models can spend the whole budget before emitting text.
        maxTokens = Math.min(maxTokens * 2, 16000);
        lastReason = "The AI ran out of output space before answering.";
        continue;
      }

      const parsed = parseJsonLoose<T>(content);
      if (parsed === null) {
        console.error("[ai] unparseable content", { finishReason, sample: content.slice(0, 400) });
        if (finishReason === "length") {
          maxTokens = Math.min(maxTokens * 2, 16000);
          lastReason = "The AI answer was cut off before it was complete.";
          continue;
        }
        return finish({
          ok: false,
          reason: "The AI returned a malformed response. Please try again.",
          retryable: true,
        });
      }

      return finish({ ok: true, data: parsed });
    } catch (error) {
      console.error("[ai] request failed", error);
      lastReason = "The AI request could not be completed.";
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        continue;
      }
    }
  }

  return finish({ ok: false, reason: lastReason, retryable: lastRetryable });
}

/** Back-compat helper: returns null on any failure. */
export async function chatJson<T>(options: {
  messages: ChatMessage[];
  model?: string;
  maxTokens?: number;
  accounting?: Accounting;
}): Promise<T | null> {
  const result = await chatJsonResult<T>(options);
  return result.ok ? result.data : null;
}
