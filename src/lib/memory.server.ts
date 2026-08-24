/**
 * Server-only AI memory: durable, embedded Business Brain memories plus
 * business-scoped semantic recall. Retrieval is always filtered by business_id.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { embedText } from "./embeddings.server";
import type { UsageContext } from "./ai-usage.server";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

export type MemoryInput = {
  businessId: string;
  memoryType: string;
  title: string | null;
  content: string;
  metadata?: Record<string, unknown>;
  sourceTable?: string | null;
  sourceId?: string | null;
  importance?: number;
  confidence?: number;
};

/**
 * Writes (or refreshes) a durable memory and its embedding.
 * Idempotent: repeated calls for the same source row update in place thanks to
 * the unique (business_id, memory_type, source_table, source_id) index.
 */
export async function writeMemory(options: {
  supabase: Client;
  memory: MemoryInput;
  accounting?: { supabase: Client; context: UsageContext };
}): Promise<{ ok: boolean; reason?: string }> {
  const { supabase, memory } = options;
  const embedInput = [memory.title, memory.content].filter(Boolean).join(" — ");
  const embedded = await embedText({
    input: embedInput,
    ...(options.accounting ? { accounting: options.accounting } : {}),
  });

  // Stored on a 0-100 scale; callers may pass either 0-1 or 0-100.
  const toScore = (value: number | undefined, fallback: number) => {
    if (value == null || Number.isNaN(value)) return fallback;
    return value <= 1 ? Math.round(value * 100) : Math.round(value);
  };

  const row = {
    business_id: memory.businessId,
    memory_type: memory.memoryType,
    title: memory.title,
    content: memory.content,
    metadata: (memory.metadata ?? {}) as never,
    source_table: memory.sourceTable ?? null,
    source_id: memory.sourceId ?? null,
    importance: toScore(memory.importance, 50),
    confidence: toScore(memory.confidence, 70),
    embedding: embedded.ok ? (JSON.stringify(embedded.embedding) as unknown as string) : null,
  };

  // The uniqueness guarantee is a partial index, which PostgREST cannot target
  // with ON CONFLICT — so do the idempotent update/insert explicitly.
  let error: { message: string } | null = null;
  if (memory.sourceId != null) {
    const { data: existing } = await supabase
      .from("ai_memory")
      .select("id")
      .eq("business_id", memory.businessId)
      .eq("memory_type", memory.memoryType)
      .eq("source_table", memory.sourceTable ?? "")
      .eq("source_id", memory.sourceId)
      .maybeSingle();
    if (existing) {
      ({ error } = await supabase.from("ai_memory").update(row).eq("id", existing.id));
    } else {
      ({ error } = await supabase.from("ai_memory").insert(row));
    }
  } else {
    ({ error } = await supabase.from("ai_memory").insert(row));
  }


  if (error) {
    console.error("[memory] write failed", error.message);
    return { ok: false, reason: error.message };
  }
  if (!embedded.ok) return { ok: false, reason: embedded.reason };
  return { ok: true };
}

export type RecalledMemory = {
  id: string;
  memoryType: string;
  title: string | null;
  content: string;
  similarity: number;
};

/** Semantic recall, strictly scoped to one business. */
export async function recallMemory(options: {
  supabase: Client;
  businessId: string;
  query: string;
  matchCount?: number;
  threshold?: number;
  accounting?: { supabase: Client; context: UsageContext };
}): Promise<RecalledMemory[]> {
  const embedded = await embedText({
    input: options.query,
    ...(options.accounting ? { accounting: options.accounting } : {}),
  });
  if (!embedded.ok) return [];

  const { data, error } = await options.supabase.rpc("match_business_memory", {
    query_embedding: JSON.stringify(embedded.embedding) as unknown as string,
    match_business_id: options.businessId,
    match_threshold: options.threshold ?? 0.6,
    match_count: options.matchCount ?? 10,
  });
  if (error) {
    console.error("[memory] recall failed", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    memoryType: row.memory_type,
    title: row.title,
    content: row.content,
    similarity: Number(row.similarity),
  }));
}

export function formatMemoryDigest(memories: RecalledMemory[]) {
  if (memories.length === 0) return "";
  return memories
    .map((m) => `- [${m.memoryType}] ${m.title ? `${m.title}: ` : ""}${m.content} (recall ${Math.round(m.similarity * 100)}%)`)
    .join("\n");
}
