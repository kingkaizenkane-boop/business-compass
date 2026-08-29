import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Plug, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState, PageHeader, SectionLabel, StatBlock } from "@/components/business-os/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspace } from "@/hooks/use-workspace";
import {
  CONNECTOR_EVENT_STATUS_LABEL,
  CONNECTOR_STATUS_LABEL,
  type ConnectorStatus,
} from "@/lib/connectors-types";
import {
  createConnector,
  getConnectorOverview,
  rotateConnectorSecret,
  sendConnectorMessage,
  setConnectorStatus,
} from "@/lib/connectors.functions";

export const Route = createFileRoute("/_authenticated/app/connectors")({
  head: () => ({
    meta: [
      { title: "Connectors — Business OS" },
      {
        name: "description",
        content:
          "One connector framework for every channel. Email is live: inbound messages become normalised events, real enquiries become leads, and nothing is invented.",
      },
      { property: "og:title", content: "Connectors — Business OS" },
      {
        property: "og:description",
        content:
          "Email, WhatsApp, CRM and payments all run through one ingestion pipeline: normalise, deduplicate, route to leads, audit.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ConnectorsPage;
});

const STATUS_TONE: Record<ConnectorStatus, string> = {
  draft: "border-border text-muted-foreground",
  connected: "border-positive/40 text-positive",
  error: "border-destructive/40 text-destructive",
  disabled: "border-border text-muted-foreground line-through",
};

function ConnectorsPage() {
  const { activeBusiness, activeOrganization, loading } = useWorkspace();
  const businessId = activeBusiness?.id ?? null;
  const organizationId = activeOrganization?.id ?? null;
  const queryClient = useQueryClient();

  const fetchOverview = useServerFn(getConnectorOverview);
  const create = useServerFn(createConnector);
  const rotate = useServerFn(rotateConnectorSecret);
  const setStatus = useServerFn(setConnectorStatus);
  const send = useServerFn(sendConnectorMessage);

  const [revealed, setRevealed] = useState<{ connectionId: string; secret: string } | null>(null);
  const [composeFor, setComposeFor] = useState<string | null>(null);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const queryKey = ["connectors", businessId];
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchOverview({ data: { businessId: businessId! } }),
    enabled: businessId !== null,
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey });

  const connect = useMutation({
    mutationFn: (provider: string) =>
      create({
        data: {
          businessId: businessId!,
          organizationId: organizationId!,
          provider,
          displayName: `${provider} connector`,
        },
      }),
    onSuccess: (result) => {
      setRevealed({ connectionId: result.connection.id, secret: result.inboundSecret });
      toast.success("Connector created. Copy the token now — it is shown once.");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rotateSecret = useMutation({
    mutationFn: (connectionId: string) =>
      rotate({ data: { businessId: businessId!, connectionId } }),
    onSuccess: (result, connectionId) => {
      setRevealed({ connectionId, secret: result.inboundSecret });
      toast.success("New token issued. The previous one no longer works.");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const toggle = useMutation({
    mutationFn: (input: { connectionId: string; status: "connected" | "disabled" }) =>
      setStatus({ data: { businessId: businessId!, ...input } }),
    onSuccess: () => {
      toast.success("Connector updated.");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const sendMessage = useMutation({
    mutationFn: (connectionId: string) =>
      send({
        data: {
          businessId: businessId!,
          connectionId,
          to: to.trim(),
          subject: subject.trim() || null,
          body,
        },
      }),
    onSuccess: () => {
      toast.success("Message sent and recorded as an outbound event.");
      setComposeFor(null);
      setTo("");
      setSubject("");
      setBody("");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (loading || (isLoading && businessId)) {
    return <div className="p-2 text-sm text-muted-foreground">Loading connectors…</div>;
  }

  const overview = data;
  const connections = overview?.connections ?? [];
  const registry = overview?.registry ?? [];
  const events = overview?.events ?? [];
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  const copy = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success("Copied.");
    } catch {
      toast.error("Copy failed — select the text manually.");
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Connect"
        title="Connectors"
        subtitle="One framework, every channel. A connector receives real activity, normalises it into a single event shape, deduplicates redeliveries and routes genuine enquiries into leads. Email is live; the rest are registry entries waiting on an adapter — never separate systems."
      />

      {overview ? (
        <section>
          <SectionLabel aside={`${connections.length} configured`}>Connector health</SectionLabel>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatBlock
              label="Connected"
              value={String(overview.summary.connected)}
              caption="Receiving live activity right now."
            />
            <StatBlock
              label="Events (7 days)"
              value={String(overview.summary.eventsLast7Days)}
              caption="Normalised events recorded from real traffic."
            />
            <StatBlock
              label="Leads created"
              value={String(overview.summary.leadsFromConnectors)}
              caption="People who reached out and became a lead."
            />
            <StatBlock
              label="Needs attention"
              value={String(overview.summary.failing)}
              caption="Connectors that failed to route an event."
            />
          </div>
        </section>
      ) : null}

      <section>
        <SectionLabel>Available channels</SectionLabel>
        <ul className="grid gap-4 lg:grid-cols-2">
          {registry.map((definition) => (
            <li
              key={definition.provider}
              className="rounded-xl border border-border bg-card p-5 shadow-quiet"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-base text-foreground">{definition.label}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                    {definition.category}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={`rounded-full ${
                    definition.availability === "available"
                      ? "border-positive/40 text-positive"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {definition.availability === "available" ? "Adapter shipped" : "Planned"}
                </Badge>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {definition.summary}
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {definition.capabilities.map((capability) => (
                  <Badge key={capability} variant="outline" className="rounded-full text-xs">
                    {capability.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
              {definition.availability === "available" && businessId && organizationId ? (
                <Button
                  className="mt-4"
                  size="sm"
                  disabled={connect.isPending}
                  onClick={() => connect.mutate(definition.provider)}
                >
                  <Plug className="mr-1.5 size-4" aria-hidden />
                  Add {definition.label.toLowerCase()} connector
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionLabel aside={`${connections.length} shown`}>Your connectors</SectionLabel>
        {connections.length === 0 ? (
          <EmptyState
            icon={Plug}
            title="No connectors yet"
            body="Add the email connector to start turning real inbound messages into normalised events and leads. Nothing is generated or simulated — a lead only appears when a real person contacts you."
            note="Each connector gets its own rotating token. The token is shown once, hashed at rest and never stored in plain text."
          />
        ) : (
          <ul className="space-y-4">
            {connections.map((connection) => (
              <li
                key={connection.id}
                className="rounded-xl border border-border bg-card p-5 shadow-quiet"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base text-foreground">{connection.displayName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {connection.providerLabel} · {connection.eventsReceived} events ·{" "}
                      {connection.leadsCreated} leads
                      {connection.lastEventAt
                        ? ` · last activity ${new Date(connection.lastEventAt).toLocaleString()}`
                        : " · no activity yet"}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`rounded-full ${STATUS_TONE[connection.status]}`}
                  >
                    {CONNECTOR_STATUS_LABEL[connection.status]}
                  </Badge>
                </div>

                {connection.lastError ? (
                  <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    {connection.lastError}
                  </p>
                ) : null}

                <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
                  <p className="eyebrow">Inbound endpoint</p>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="min-w-0 flex-1 truncate text-xs text-foreground">
                      {origin}
                      {connection.webhookPath}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void copy(`${origin}${connection.webhookPath}`)}
                    >
                      <Copy className="size-3.5" aria-hidden />
                    </Button>
                  </div>
                  {revealed?.connectionId === connection.id ? (
                    <div className="mt-3">
                      <p className="eyebrow">Token — shown once</p>
                      <div className="mt-1 flex items-center gap-2">
                        <code className="min-w-0 flex-1 truncate text-xs text-foreground">
                          {revealed.secret}
                        </code>
                        <Button size="sm" variant="outline" onClick={() => void copy(revealed.secret)}>
                          <Copy className="size-3.5" aria-hidden />
                        </Button>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Send it as <code>Authorization: Bearer &lt;token&gt;</code> or as{" "}
                        <code>?token=</code>.
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={rotateSecret.isPending}
                    onClick={() => rotateSecret.mutate(connection.id)}
                  >
                    Rotate token
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={toggle.isPending}
                    onClick={() =>
                      toggle.mutate({
                        connectionId: connection.id,
                        status: connection.status === "disabled" ? "connected" : "disabled",
                      })
                    }
                  >
                    {connection.status === "disabled" ? "Enable" : "Disable"}
                  </Button>
                  {connection.capabilities.includes("outbound_message") ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setComposeFor(composeFor === connection.id ? null : connection.id)
                      }
                    >
                      <Send className="mr-1.5 size-3.5" aria-hidden />
                      {composeFor === connection.id ? "Close" : "Send a message"}
                    </Button>
                  ) : null}
                </div>

                {composeFor === connection.id ? (
                  <div className="mt-4 space-y-3 rounded-lg border border-border p-4">
                    {connection.outboundReady ? null : (
                      <p className="text-sm text-caution-foreground">
                        Outbound sending needs a sending credential configured for this channel.
                      </p>
                    )}
                    <Input
                      value={to}
                      onChange={(event) => setTo(event.target.value)}
                      placeholder="Recipient"
                      aria-label="Recipient"
                    />
                    <Input
                      value={subject}
                      onChange={(event) => setSubject(event.target.value)}
                      placeholder="Subject"
                      aria-label="Subject"
                    />
                    <Textarea
                      value={body}
                      onChange={(event) => setBody(event.target.value)}
                      placeholder="Message"
                      aria-label="Message"
                      rows={4}
                    />
                    <Button
                      size="sm"
                      disabled={sendMessage.isPending || to.trim().length < 3 || body.length === 0}
                      onClick={() => sendMessage.mutate(connection.id)}
                    >
                      Send
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {events.length > 0 ? (
        <section>
          <SectionLabel aside={`${events.length} most recent`}>Normalised events</SectionLabel>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-quiet">
            {events.map((event) => (
              <li key={event.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-foreground">
                    {event.subject ?? event.eventType}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {event.contactEmail ?? event.contactPhone ?? "no contact identity"}
                    </span>
                  </p>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="rounded-full text-xs">
                      {event.providerLabel} · {event.direction}
                    </Badge>
                    <Badge variant="outline" className="rounded-full text-xs">
                      {CONNECTOR_EVENT_STATUS_LABEL[event.status]}
                    </Badge>
                  </div>
                </div>
                {event.bodyPreview ? (
                  <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                    {event.bodyPreview}
                  </p>
                ) : null}
                <p className="mt-2 text-xs text-muted-foreground">
                  {new Date(event.occurredAt).toLocaleString()}
                  {event.routedAction ? ` · ${event.routedAction.replace(/_/g, " ")}` : ""}
                  {event.error ? ` · ${event.error}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
