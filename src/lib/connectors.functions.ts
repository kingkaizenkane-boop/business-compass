/**
 * Connector framework — typed RPC surface. Thin wrappers only.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const businessInput = z.object({ businessId: z.string().uuid() });

/** Connections, recent normalised events and the provider registry. */
export const getConnectorOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => businessInput.parse(input))
  .handler(async ({ data, context }) => {
    const { loadConnectorOverview } = await import("./connectors.server");
    return loadConnectorOverview(context.supabase, data.businessId);
  });

/** Creates a connection and returns its inbound token once, never again. */
export const createConnector = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    businessInput
      .extend({
        organizationId: z.string().uuid(),
        provider: z.string().min(1),
        displayName: z.string().min(1).max(80),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { createConnection } = await import("./connectors.server");
    return createConnection({
      supabase: context.supabase,
      businessId: data.businessId,
      organizationId: data.organizationId,
      userId: context.userId,
      provider: data.provider,
      displayName: data.displayName,
    });
  });

/** Issues a fresh inbound token; the previous one stops working immediately. */
export const rotateConnectorSecret = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    businessInput.extend({ connectionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { rotateInboundSecret } = await import("./connectors.server");
    return rotateInboundSecret({
      supabase: context.supabase,
      businessId: data.businessId,
      connectionId: data.connectionId,
      userId: context.userId,
    });
  });

/** Enables or disables inbound traffic for one connection. */
export const setConnectorStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    businessInput
      .extend({
        connectionId: z.string().uuid(),
        status: z.enum(["connected", "disabled"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { setConnectionStatus } = await import("./connectors.server");
    return setConnectionStatus({
      supabase: context.supabase,
      businessId: data.businessId,
      connectionId: data.connectionId,
      userId: context.userId,
      status: data.status,
    });
  });

/** Sends one message through a connector that supports outbound. */
export const sendConnectorMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    businessInput
      .extend({
        connectionId: z.string().uuid(),
        to: z.string().min(3).max(200),
        subject: z.string().max(200).nullable(),
        body: z.string().min(1).max(5000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { sendOutbound } = await import("./connectors.server");
    return sendOutbound({
      supabase: context.supabase,
      businessId: data.businessId,
      connectionId: data.connectionId,
      userId: context.userId,
      to: data.to,
      subject: data.subject,
      body: data.body,
    });
  });
