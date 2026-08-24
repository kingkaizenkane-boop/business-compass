/**
 * Server-only embedding generation via the Lovable AI Gateway.
 * Produces 1536-dimension vectors matching public.ai_memory.embedding.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { AI_MODELS, recordAiUsage, type UsageContext } from "./ai-usage.server";
import type { Database } from "@/integrations/supabase/types";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/embeddings";

export const EMBEDDING_DIMENSIONS = 1536;

export type EmbedResult =
  | { ok: true; embedding: number[] }
  | { ok: false; reason: string; retryable: boolean };

export async function embedText(options: {
  input: string;
  accounting?: { supabase: SupabaseClient<Database>; context: UsageContext };
}): Promise<EmbedResult> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) {
    return { ok: false, reason: "AI is not configured for this project.", retryable: false };
  }

  const text = options.input.slice(0, 8000).trim();
  if (text.length === 0) return { ok: false, reason: "Nothing to embed.", retryable: false };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({ model: AI_MODELS.embedding, input: text }),
      });

      if (!response.ok) {
        const body = await response.text();
        console.error("[embeddings] gateway error", response.status, body.slice(0, 400));
        if (response.status === 402) {
          return { ok: false, reason: "AI credits are exhausted.", retryable: false };
        }
        if (response.status === 403) {
          return { ok: false, reason: "AI usage is blocked by workspace policy.", retryable: false };
        }
        if (response.status === 429 || response.status >= 500) {
          if (attempt < 2) {
            const retryAfter = Number(response.headers.get("retry-after") ?? 0);
            await new Promise((r) => setTimeout(r, Math.max(retryAfter * 1000, 800 * (attempt + 1))));
            continue;
          }
          return { ok: false, reason: "The embedding service is unavailable.", retryable: true };
        }
        return { ok: false, reason: `Embedding request rejected (${response.status}).`, retryable: false };
      }

      const payload = (await response.json()) as {
        data?: Array<{ embedding?: number[] }>;
        usage?: { prompt_tokens?: number; total_tokens?: number };
      };
      const embedding = payload.data?.[0]?.embedding;
      if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS) {
        return { ok: false, reason: "The embedding response was malformed.", retryable: true };
      }

      if (options.accounting) {
        const promptTokens = payload.usage?.prompt_tokens ?? payload.usage?.total_tokens ?? 0;
        await recordAiUsage({
          supabase: options.accounting.supabase,
          context: options.accounting.context,
          model: AI_MODELS.embedding,
          usage: { promptTokens, completionTokens: 0, totalTokens: promptTokens },
          succeeded: true,
        });
      }

      return { ok: true, embedding };
    } catch (error) {
      console.error("[embeddings] request failed", error);
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        continue;
      }
    }
  }

  return { ok: false, reason: "The embedding request could not be completed.", retryable: true };
}
