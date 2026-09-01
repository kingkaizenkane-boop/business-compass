/**
 * Connector framework — client-safe types and the provider registry.
 *
 * DESIGN RULE (P3.1): there is exactly ONE connector framework. Email,
 * WhatsApp, CRM and payments are providers inside it, never bespoke systems.
 * A new provider means: one adapter (parse + optional send) and one registry
 * entry. Ingestion, deduplication, normalisation, lead routing, auditing,
 * secrets handling and the UI are shared and are never re-implemented.
 */

export const CONNECTOR_PROVIDERS = ["email", "whatsapp", "crm", "payments", "webform"] as const;
export type ConnectorProvider = (typeof CONNECTOR_PROVIDERS)[number];

export const CONNECTOR_CAPABILITIES = [
  "inbound_events",
  "outbound_message",
  "contact_sync",
  "transaction_sync",
] as const;
export type ConnectorCapability = (typeof CONNECTOR_CAPABILITIES)[number];

export type ConnectorStatus = "draft" | "connected" | "error" | "disabled";
export type ConnectorDirection = "inbound" | "outbound";
export type ConnectorEventStatus = "received" | "normalized" | "routed" | "ignored" | "failed";

export const CONNECTOR_STATUS_LABEL: Record<ConnectorStatus, string> = {
  draft: "Not receiving yet",
  connected: "Connected",
  error: "Needs attention",
  disabled: "Disabled",
};

export const CONNECTOR_EVENT_STATUS_LABEL: Record<ConnectorEventStatus, string> = {
  received: "Received",
  normalized: "Normalised",
  routed: "Routed",
  ignored: "Ignored",
  failed: "Failed",
};

/** What the framework can do with a provider, and whether an adapter exists. */
export type ConnectorDefinition = {
  provider: ConnectorProvider;
  label: string;
  category: "communication" | "crm" | "revenue" | "acquisition";
  /** available = adapter shipped. planned = registry entry only, same pipeline. */
  availability: "available" | "planned";
  summary: string;
  capabilities: ConnectorCapability[];
  /** Source recorded on leads created from this provider (source_type enum). */
  leadSource: "email" | "whatsapp" | "other" | "website";
  /** Name of the platform secret an outbound adapter needs, if any. */
  outboundSecretName?: string;
};

export const CONNECTOR_REGISTRY: ConnectorDefinition[] = [
  {
    provider: "email",
    label: "Email",
    category: "communication",
    availability: "available",
    summary:
      "Forward or relay inbound email into Business OS. Every message becomes a normalised event, and a genuine enquiry becomes a lead with the original message kept as evidence.",
    capabilities: ["inbound_events", "outbound_message", "contact_sync"],
    leadSource: "email",
    outboundSecretName: "RESEND_API_KEY",
  },
  {
    provider: "whatsapp",
    label: "WhatsApp",
    category: "communication",
    availability: "planned",
    summary:
      "Same pipeline as email: an adapter maps WhatsApp webhooks onto the shared normalised event, then routing, deduplication and lead creation are reused unchanged.",
    capabilities: ["inbound_events", "outbound_message"],
    leadSource: "whatsapp",
  },
  {
    provider: "crm",
    label: "CRM",
    category: "crm",
    availability: "planned",
    summary:
      "Contact and deal sync arrives as normalised events from a CRM adapter. No separate CRM subsystem is built inside Business OS.",
    capabilities: ["inbound_events", "contact_sync"],
    leadSource: "other",
  },
  {
    provider: "payments",
    label: "Payments",
    category: "revenue",
    availability: "planned",
    summary:
      "Payment webhooks become transaction events that feed customers, lifetime value and the Metrics engine — through the same connector ingestion path.",
    capabilities: ["inbound_events", "transaction_sync"],
    leadSource: "other",
  },
  {
    provider: "webform",
    label: "Website form",
    category: "acquisition",
    availability: "planned",
    summary:
      "Website and landing-page form posts are just inbound events with a contact payload, routed to leads by the shared router.",
    capabilities: ["inbound_events"],
    leadSource: "website",
  },
];

export function connectorDefinition(provider: string): ConnectorDefinition | null {
  return CONNECTOR_REGISTRY.find((entry) => entry.provider === provider) ?? null;
}

export function connectorLabel(provider: string): string {
  return connectorDefinition(provider)?.label ?? provider;
}

/**
 * The single normalised shape every adapter must produce. The framework only
 * ever reasons about this — never about a provider's raw payload.
 */
export type NormalizedConnectorEvent = {
  /** Provider-side identifier used for deduplication. Null = never deduped. */
  externalId: string | null;
  eventType: string;
  occurredAt: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  subject: string | null;
  bodyPreview: string | null;
  /** What the router should do with this event. */
  intent: "enquiry" | "message" | "transaction" | "contact" | "unknown";
  payload: Record<string, unknown>;
};

export type ConnectorConnectionView = {
  id: string;
  provider: ConnectorProvider | string;
  providerLabel: string;
  displayName: string;
  status: ConnectorStatus;
  capabilities: string[];
  inboundConfigured: boolean;
  outboundReady: boolean;
  /** Plain-language reason outbound is not usable yet; null when ready. */
  outboundBlockedReason: string | null;
  credentialSecretName: string | null;
  config: Record<string, string | null>;
  webhookPath: string;
  lastEventAt: string | null;
  lastError: string | null;
  eventsReceived: number;
  leadsCreated: number;
  createdAt: string;
};

export type ConnectorEventView = {
  id: string;
  connectionId: string;
  provider: string;
  providerLabel: string;
  direction: ConnectorDirection;
  eventType: string;
  status: ConnectorEventStatus;
  occurredAt: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  subject: string | null;
  bodyPreview: string | null;
  leadId: string | null;
  routedAction: string | null;
  error: string | null;
};

export type ConnectorOverview = {
  connections: ConnectorConnectionView[];
  events: ConnectorEventView[];
  registry: ConnectorDefinition[];
  summary: {
    connected: number;
    eventsLast7Days: number;
    leadsFromConnectors: number;
    failing: number;
  };
};

export function webhookPathFor(connectionId: string): string {
  return `/api/public/connectors/${connectionId}`;
}
