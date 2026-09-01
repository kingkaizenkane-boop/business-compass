/**
 * Connector framework — server engine.
 *
 * One pipeline for every provider:
 *
 *   raw provider payload
 *     -> adapter.parseInbound()            (provider-specific, tiny)
 *     -> NormalizedConnectorEvent[]        (shared contract)
 *     -> persist to connector_events       (deduped on external_id)
 *     -> route()                           (shared: leads / customers)
 *     -> audit + connection health counters
 *
 * Adding WhatsApp, a CRM or payments means writing one adapter — never a new
 * ingestion path, router, secret store, UI or audit vocabulary.
 *
 * Secrets: only a SHA-256 hash of an inbound token is persisted. Outbound
 * credentials live in platform secrets and are referenced by name only.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { writeAudit } from "./audit.server";
import {
  type ConnectorConnectionView,
  type ConnectorEventView,
  type ConnectorOverview,
  type ConnectorProvider,
  type ConnectorStatus,
  type NormalizedConnectorEvent,
  CONNECTOR_REGISTRY,
  connectorDefinition,
  connectorLabel,
  webhookPathFor,
} from "./connectors-types";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;
type ConnectionRow = Database["public"]["Tables"]["connector_connections"]["Row"];
type EventRow = Database["public"]["Tables"]["connector_events"]["Row"];

/* --------------------------------------------------------------- adapters */

type ConnectorAdapter = {
  provider: ConnectorProvider;
  /** Maps a raw provider payload onto the shared normalised contract. */
  parseInbound(raw: unknown): NormalizedConnectorEvent[];
  /** Optional outbound send. Absent = provider is inbound-only for now. */
  send?(input: {
    connection: ConnectionRow;
    to: string;
    subject: string | null;
    body: string;
  }): Promise<{ externalId: string | null }>;
  /** Optional readiness check: credential present AND sender identity complete. */
  outboundReadiness?(connection: ConnectionRow): { ready: boolean; reason: string | null };
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function str(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Pulls "Name <a@b.com>" or "a@b.com" apart without guessing anything else. */
function parseAddress(value: string | null): { name: string | null; email: string | null } {
  if (!value) return { name: null, email: null };
  const angled = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(value);
  if (angled) {
    return {
      name: str(angled[1]?.replace(/^"|"$/g, "") ?? null),
      email: str(angled[2] ?? null)?.toLowerCase() ?? null,
    };
  }
  const bare = str(value);
  if (bare && bare.includes("@")) return { name: null, email: bare.toLowerCase() };
  return { name: bare, email: null };
}

const EMAIL_AUTOMATED =
  /^(no-?reply|do-?not-?reply|postmaster|mailer-daemon|bounce|notifications?)@/i;

/**
 * Email adapter. Accepts the common inbound-email webhook shapes (Resend,
 * Postmark, SendGrid inbound parse, or a plain forwarder) by reading a small
 * set of well-known field names. Nothing is inferred beyond what is present.
 */
export type EmailConnectorConfig = {
  fromEmail: string | null;
  fromName: string | null;
  replyTo: string | null;
};

/** Sender identity for one email connection. Stored on the connection, never guessed. */
function emailConfig(connection: ConnectionRow): EmailConnectorConfig {
  const config = asRecord(connection.config);
  return {
    fromEmail: str(config["fromEmail"])?.toLowerCase() ?? null,
    fromName: str(config["fromName"]),
    replyTo: str(config["replyTo"])?.toLowerCase() ?? null,
  };
}

const emailAdapter: ConnectorAdapter = {
  provider: "email",
  parseInbound(raw) {
    const root = asRecord(raw);
    const body = asRecord(root["data"] ?? root["message"] ?? root);

    const fromRaw =
      str(body["from"]) ??
      str(body["From"]) ??
      str(body["sender"]) ??
      str(asRecord(body["from"])["email"]);
    const from = parseAddress(fromRaw);
    const explicitName =
      str(body["from_name"]) ?? str(body["FromName"]) ?? str(asRecord(body["from"])["name"]);

    const subject = str(body["subject"]) ?? str(body["Subject"]);
    const text =
      str(body["text"]) ??
      str(body["TextBody"]) ??
      str(body["plain"]) ??
      str(body["body"]) ??
      str(body["html"]) ??
      str(body["HtmlBody"]);

    const externalId =
      str(body["message_id"]) ??
      str(body["messageId"]) ??
      str(body["MessageID"]) ??
      str(root["id"]) ??
      null;

    const occurredAt = str(body["date"]) ?? str(body["Date"]) ?? str(root["created_at"]);
    const parsedDate = occurredAt ? new Date(occurredAt) : null;

    const automated = from.email ? EMAIL_AUTOMATED.test(from.email) : false;
    const plainText = text ? text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : null;

    return [
      {
        externalId,
        eventType: "email.received",
        occurredAt:
          parsedDate && !Number.isNaN(parsedDate.getTime())
            ? parsedDate.toISOString()
            : new Date().toISOString(),
        contactName: explicitName ?? from.name,
        contactEmail: from.email,
        contactPhone: null,
        subject,
        bodyPreview: plainText ? plainText.slice(0, 600) : null,
        // An automated sender is a message, never a person to follow up with.
        intent: automated ? "message" : from.email ? "enquiry" : "unknown",
        payload: {
          to: str(body["to"]) ?? str(body["To"]),
          subject,
          text: plainText,
          headers: asRecord(body["headers"]),
        },
      },
    ];
  },
  outboundReadiness(connection) {
    const config = emailConfig(connection);
    if (!process.env["RESEND_API_KEY"]) {
      return {
        ready: false,
        reason:
          "The email sending credential is not set on this project yet, so sends are refused rather than silently dropped.",
      };
    }
    if (!config.fromEmail) {
      return { ready: false, reason: "No verified sender address configured for this connector." };
    }
    return { ready: true, reason: null };
  },
  async send({ connection, to, subject, body }) {
    const key = process.env["RESEND_API_KEY"];
    const config = emailConfig(connection);
    const from = config.fromName
      ? `${config.fromName} <${config.fromEmail}>`
      : (config.fromEmail ?? process.env["CONNECTOR_EMAIL_FROM"] ?? null);
    if (!key || !from) {
      throw new Error(
        "Outbound email is not configured. Set the sender address on the connector and add the email sending credential before sending.",
      );
    }
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from,
        to,
        subject: subject ?? "(no subject)",
        text: body,
        ...(emailConfig(connection).replyTo ? { reply_to: emailConfig(connection).replyTo } : {}),
      }),
    });
    if (!response.ok) {
      throw new Error(`Email provider rejected the send (${response.status}).`);
    }
    const json = (await response.json().catch(() => ({}))) as { id?: string };
    return { externalId: json.id ?? null };
  },
};

const ADAPTERS: Partial<Record<ConnectorProvider, ConnectorAdapter>> = {
  email: emailAdapter,
};

export function adapterFor(provider: string): ConnectorAdapter | null {
  return ADAPTERS[provider as ConnectorProvider] ?? null;
}

/* ---------------------------------------------------------------- secrets */

async function sha256(value: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha256").update(value, "utf8").digest("hex");
}

async function constantTimeEqualHex(a: string, b: string): Promise<boolean> {
  const { timingSafeEqual } = await import("node:crypto");
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

async function admin(): Promise<Client> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as Client;
}

/* -------------------------------------------------------------- read side */

function toConnectionView(row: ConnectionRow): ConnectorConnectionView {
  const definition = connectorDefinition(row.provider);
  const secretName = definition?.outboundSecretName;
  const adapter = adapterFor(row.provider);
  const readiness = adapter?.outboundReadiness
    ? adapter.outboundReadiness(row)
    : { ready: secretName ? Boolean(process.env[secretName]) : false, reason: null };
  return {
    id: row.id,
    provider: row.provider,
    providerLabel: connectorLabel(row.provider),
    displayName: row.display_name,
    status: row.status as ConnectorStatus,
    capabilities: row.capabilities ?? [],
    inboundConfigured: Boolean(row.inbound_secret_hash),
    outboundReady: readiness.ready,
    outboundBlockedReason: readiness.reason,
    credentialSecretName: secretName ?? null,
    config: asRecord(row.config) as Record<string, string | null>,
    webhookPath: webhookPathFor(row.id),
    lastEventAt: row.last_event_at,
    lastError: row.last_error,
    eventsReceived: row.events_received,
    leadsCreated: row.leads_created,
    createdAt: row.created_at,
  };
}

function toEventView(row: EventRow): ConnectorEventView {
  return {
    id: row.id,
    connectionId: row.connection_id,
    provider: row.provider,
    providerLabel: connectorLabel(row.provider),
    direction: row.direction,
    eventType: row.event_type,
    status: row.status,
    occurredAt: row.occurred_at,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    subject: row.subject,
    bodyPreview: row.body_preview,
    leadId: row.lead_id,
    routedAction: row.routed_action,
    error: row.error,
  };
}

/** Everything the connectors surface needs, read as the signed-in user (RLS). */
export async function loadConnectorOverview(
  supabase: Client,
  businessId: string,
): Promise<ConnectorOverview> {
  const [connectionsResult, eventsResult] = await Promise.all([
    supabase
      .from("connector_connections")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: true }),
    supabase
      .from("connector_events")
      .select("*")
      .eq("business_id", businessId)
      .order("occurred_at", { ascending: false })
      .limit(60),
  ]);

  const connections = (connectionsResult.data ?? []).map(toConnectionView);
  const events = (eventsResult.data ?? []).map(toEventView);
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  return {
    connections,
    events,
    registry: CONNECTOR_REGISTRY,
    summary: {
      connected: connections.filter((c) => c.status === "connected").length,
      eventsLast7Days: events.filter((e) => new Date(e.occurredAt).getTime() >= weekAgo).length,
      leadsFromConnectors: connections.reduce((total, c) => total + c.leadsCreated, 0),
      failing: connections.filter((c) => c.status === "error").length,
    },
  };
}

/* ------------------------------------------------------------- write side */

export async function createConnection(input: {
  supabase: Client;
  businessId: string;
  organizationId: string;
  userId: string;
  provider: string;
  displayName: string;
}): Promise<{ connection: ConnectorConnectionView; inboundSecret: string }> {
  const definition = connectorDefinition(input.provider);
  if (!definition) throw new Error("Unknown connector provider.");
  if (definition.availability !== "available") {
    throw new Error(
      `${definition.label} is registered but its adapter is not shipped yet. It will use this same framework — nothing bespoke.`,
    );
  }

  const secret = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const hash = await sha256(secret);

  const { data, error } = await input.supabase
    .from("connector_connections")
    .insert({
      organization_id: input.organizationId,
      business_id: input.businessId,
      provider: definition.provider,
      display_name: input.displayName.trim() || definition.label,
      status: "connected",
      capabilities: definition.capabilities,
      credential_secret_name: definition.outboundSecretName ?? null,
      inbound_secret_hash: hash,
      inbound_secret_set_at: new Date().toISOString(),
      created_by: input.userId,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  await writeAudit({
    supabase: input.supabase,
    action: "connector.created",
    organizationId: input.organizationId,
    businessId: input.businessId,
    userId: input.userId,
    entity: "connector_connections",
    entityId: data.id,
    after: { provider: data.provider, displayName: data.display_name },
  });

  return { connection: toConnectionView(data), inboundSecret: secret };
}

export async function rotateInboundSecret(input: {
  supabase: Client;
  businessId: string;
  connectionId: string;
  userId: string;
}): Promise<{ inboundSecret: string }> {
  const secret = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const { data, error } = await input.supabase
    .from("connector_connections")
    .update({
      inbound_secret_hash: await sha256(secret),
      inbound_secret_set_at: new Date().toISOString(),
    })
    .eq("id", input.connectionId)
    .eq("business_id", input.businessId)
    .select("organization_id")
    .single();
  if (error) throw new Error(error.message);

  await writeAudit({
    supabase: input.supabase,
    action: "connector.secret_rotated",
    organizationId: data.organization_id,
    businessId: input.businessId,
    userId: input.userId,
    entity: "connector_connections",
    entityId: input.connectionId,
  });

  return { inboundSecret: secret };
}

export async function setConnectionStatus(input: {
  supabase: Client;
  businessId: string;
  connectionId: string;
  userId: string;
  status: Extract<ConnectorStatus, "connected" | "disabled">;
}): Promise<ConnectorConnectionView> {
  const { data, error } = await input.supabase
    .from("connector_connections")
    .update(
      input.status === "connected"
        ? { status: input.status, last_error: null }
        : { status: input.status },
    )
    .eq("id", input.connectionId)
    .eq("business_id", input.businessId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await writeAudit({
    supabase: input.supabase,
    action: input.status === "connected" ? "connector.enabled" : "connector.disabled",
    organizationId: data.organization_id,
    businessId: input.businessId,
    userId: input.userId,
    entity: "connector_connections",
    entityId: data.id,
  });

  return toConnectionView(data);
}

/* ------------------------------------------------------------- ingestion */

/**
 * Authenticates an inbound webhook against a connection's rotating token.
 * Returns null for unknown, disabled or unauthenticated callers — the route
 * must not reveal which of those it was.
 */
export async function authenticateInbound(
  connectionId: string,
  token: string | null,
): Promise<ConnectionRow | null> {
  if (!token) return null;
  const db = await admin();
  const { data } = await db
    .from("connector_connections")
    .select("*")
    .eq("id", connectionId)
    .maybeSingle();
  if (!data || !data.inbound_secret_hash) return null;
  if (data.status === "disabled") return null;
  const ok = await constantTimeEqualHex(await sha256(token), data.inbound_secret_hash);
  return ok ? data : null;
}

type RouteResult = { action: string; leadId: string | null; customerId: string | null };

/**
 * The shared router. Provider-agnostic: it only reads the normalised event.
 * Contacts are matched on email, then phone, so repeat enquiries update the
 * existing lead instead of creating duplicates.
 */
async function routeEvent(
  db: Client,
  connection: ConnectionRow,
  event: NormalizedConnectorEvent,
): Promise<RouteResult> {
  const definition = connectorDefinition(connection.provider);
  const source = definition?.leadSource ?? "other";

  if (event.intent === "message" || event.intent === "unknown") {
    return { action: "logged_only", leadId: null, customerId: null };
  }

  if (!event.contactEmail && !event.contactPhone) {
    return { action: "no_contact_identity", leadId: null, customerId: null };
  }

  const existing = await (async () => {
    if (event.contactEmail) {
      const { data } = await db
        .from("leads")
        .select("id, metadata")
        .eq("business_id", connection.business_id)
        .eq("email", event.contactEmail)
        .limit(1)
        .maybeSingle();
      if (data) return data;
    }
    if (event.contactPhone) {
      const { data } = await db
        .from("leads")
        .select("id, metadata")
        .eq("business_id", connection.business_id)
        .eq("phone", event.contactPhone)
        .limit(1)
        .maybeSingle();
      if (data) return data;
    }
    return null;
  })();

  const nameParts = (event.contactName ?? "").split(/\s+/).filter(Boolean);
  const provenance = {
    connectorProvider: connection.provider,
    connectorConnectionId: connection.id,
    lastEventType: event.eventType,
    lastEventAt: event.occurredAt,
  };

  if (existing) {
    await db
      .from("leads")
      .update({
        metadata: {
          ...asRecord(existing.metadata),
          ...provenance,
        } as never,
      })
      .eq("id", existing.id);
    return { action: "lead_updated", leadId: existing.id, customerId: null };
  }

  const { data: created, error } = await db
    .from("leads")
    .insert({
      business_id: connection.business_id,
      first_name: nameParts[0] ?? null,
      last_name: nameParts.length > 1 ? nameParts.slice(1).join(" ") : null,
      email: event.contactEmail,
      phone: event.contactPhone,
      source: source as Database["public"]["Enums"]["source_type"],
      status: "new",
      notes: event.subject ? `${event.subject}\n\n${event.bodyPreview ?? ""}`.trim() : event.bodyPreview,
      metadata: provenance as never,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Lead routing failed: ${error.message}`);
  return { action: "lead_created", leadId: created.id, customerId: null };
}

export type IngestSummary = {
  received: number;
  stored: number;
  duplicates: number;
  leadsCreated: number;
  failed: number;
};

/**
 * Single ingestion entry point for every provider. Idempotent per external id:
 * a redelivered webhook is counted as a duplicate and never re-routed.
 */
export async function ingestInbound(input: {
  connection: ConnectionRow;
  raw: unknown;
}): Promise<IngestSummary> {
  const db = await admin();
  const { connection } = input;
  const adapter = adapterFor(connection.provider);
  const summary: IngestSummary = {
    received: 0,
    stored: 0,
    duplicates: 0,
    leadsCreated: 0,
    failed: 0,
  };

  if (!adapter) throw new Error(`No adapter for provider "${connection.provider}".`);

  const events = adapter.parseInbound(input.raw);
  summary.received = events.length;

  for (const event of events) {
    if (event.externalId) {
      const { data: seen } = await db
        .from("connector_events")
        .select("id")
        .eq("connection_id", connection.id)
        .eq("external_id", event.externalId)
        .maybeSingle();
      if (seen) {
        summary.duplicates += 1;
        continue;
      }
    }

    const { data: row, error } = await db
      .from("connector_events")
      .insert({
        organization_id: connection.organization_id,
        business_id: connection.business_id,
        connection_id: connection.id,
        provider: connection.provider,
        direction: "inbound",
        event_type: event.eventType,
        external_id: event.externalId,
        status: "normalized",
        occurred_at: event.occurredAt,
        contact_name: event.contactName,
        contact_email: event.contactEmail,
        contact_phone: event.contactPhone,
        subject: event.subject,
        body_preview: event.bodyPreview,
        payload: event.payload as never,
      })
      .select("id")
      .single();

    if (error || !row) {
      // A unique-index collision means a concurrent redelivery won the race.
      summary.duplicates += 1;
      continue;
    }
    summary.stored += 1;

    try {
      const routed = await routeEvent(db, connection, event);
      await db
        .from("connector_events")
        .update({
          status: routed.leadId || routed.customerId ? "routed" : "ignored",
          routed_action: routed.action,
          lead_id: routed.leadId,
          customer_id: routed.customerId,
        })
        .eq("id", row.id);
      if (routed.action === "lead_created") summary.leadsCreated += 1;
    } catch (routingError) {
      summary.failed += 1;
      const message =
        routingError instanceof Error ? routingError.message : "Routing failed unexpectedly.";
      await db
        .from("connector_events")
        .update({ status: "failed", error: message.slice(0, 500) })
        .eq("id", row.id);
    }
  }

  await db
    .from("connector_connections")
    .update({
      last_event_at: new Date().toISOString(),
      events_received: connection.events_received + summary.stored,
      leads_created: connection.leads_created + summary.leadsCreated,
      status: summary.failed > 0 ? "error" : "connected",
      last_error: summary.failed > 0 ? "Some events could not be routed." : null,
    })
    .eq("id", connection.id);

  await writeAudit({
    action: "connector.events_ingested",
    organizationId: connection.organization_id,
    businessId: connection.business_id,
    actor: "system",
    entity: "connector_connections",
    entityId: connection.id,
    metadata: { provider: connection.provider, ...summary },
  });

  return summary;
}

/* -------------------------------------------------------------- outbound */

export async function sendOutbound(input: {
  supabase: Client;
  businessId: string;
  connectionId: string;
  userId: string;
  to: string;
  subject: string | null;
  body: string;
}): Promise<{ sent: true }> {
  const { data: connection, error } = await input.supabase
    .from("connector_connections")
    .select("*")
    .eq("id", input.connectionId)
    .eq("business_id", input.businessId)
    .single();
  if (error || !connection) throw new Error("Connector not found.");
  if (connection.status === "disabled") throw new Error("This connector is disabled.");

  const adapter = adapterFor(connection.provider);
  if (!adapter?.send) throw new Error("This connector cannot send messages yet.");

  const result = await adapter.send({
    connection,
    to: input.to,
    subject: input.subject,
    body: input.body,
  });

  const db = await admin();
  await db.from("connector_events").insert({
    organization_id: connection.organization_id,
    business_id: connection.business_id,
    connection_id: connection.id,
    provider: connection.provider,
    direction: "outbound",
    event_type: `${connection.provider}.sent`,
    external_id: result.externalId,
    status: "routed",
    occurred_at: new Date().toISOString(),
    contact_email: input.to.includes("@") ? input.to.toLowerCase() : null,
    contact_phone: input.to.includes("@") ? null : input.to,
    subject: input.subject,
    body_preview: input.body.slice(0, 600),
    routed_action: "outbound_sent",
    payload: { to: input.to } as never,
  });

  await writeAudit({
    supabase: input.supabase,
    action: "connector.message_sent",
    organizationId: connection.organization_id,
    businessId: input.businessId,
    userId: input.userId,
    entity: "connector_connections",
    entityId: connection.id,
    metadata: { provider: connection.provider },
  });

  return { sent: true };
}
