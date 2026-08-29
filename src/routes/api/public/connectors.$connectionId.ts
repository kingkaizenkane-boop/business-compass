import { createFileRoute } from "@tanstack/react-router";

/**
 * Universal connector inbound webhook.
 *
 * One endpoint for every provider: the connection id selects the tenant and
 * the adapter, and the rotating per-connection token authenticates the caller.
 * There is no provider-specific endpoint, and no unauthenticated write path.
 *
 * Token may arrive as `Authorization: Bearer <token>` or `?token=<token>`
 * (some email relays cannot set headers).
 */
export const Route = createFileRoute("/api/public/connectors/$connectionId")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const url = new URL(request.url);
        const header = /^Bearer ([^\s,]+)$/.exec(request.headers.get("authorization") ?? "");
        const token = header?.[1] ?? url.searchParams.get("token");

        const { authenticateInbound, ingestInbound } = await import("@/lib/connectors.server");

        const connection = await authenticateInbound(params.connectionId, token).catch(() => null);
        if (!connection) return new Response("Unauthorized", { status: 401 });

        let raw: unknown;
        const contentType = request.headers.get("content-type") ?? "";
        try {
          if (contentType.includes("application/json")) {
            raw = await request.json();
          } else if (
            contentType.includes("application/x-www-form-urlencoded") ||
            contentType.includes("multipart/form-data")
          ) {
            raw = Object.fromEntries(await request.formData());
          } else {
            raw = JSON.parse(await request.text());
          }
        } catch {
          return Response.json({ ok: false, error: "Unreadable payload" }, { status: 400 });
        }

        try {
          const summary = await ingestInbound({ connection, raw });
          return Response.json({ ok: true, ...summary });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Ingestion failed";
          console.error("[connectors] ingest failed", connection.provider, message);
          return Response.json({ ok: false, error: message }, { status: 500 });
        }
      },
    },
  },
});
