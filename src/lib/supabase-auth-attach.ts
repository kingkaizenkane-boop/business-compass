import { createMiddleware } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";

// Replaces the generated attacher: on a cold load the Supabase session is still
// being restored from storage, so getSession() can briefly return null and the
// serverFn goes out without a bearer token ("Unauthorized: No authorization
// header provided"). Wait a short moment for hydration before giving up.
async function resolveAccessToken(timeoutMs = 4000): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  if (data.session?.access_token) return data.session.access_token;

  return new Promise<string | null>((resolve) => {
    let settled = false;
    const finish = (token: string | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      sub.subscription.unsubscribe();
      resolve(token);
    };

    const sub = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) finish(session.access_token);
    });

    const timer = setTimeout(() => {
      void supabase.auth
        .getSession()
        .then(({ data: retry }) => finish(retry.session?.access_token ?? null))
        .catch(() => finish(null));
    }, timeoutMs);
  });
}

export const attachSupabaseAuthWithWait = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const token = typeof window === "undefined" ? null : await resolveAccessToken();
    return next({ headers: token ? { Authorization: `Bearer ${token}` } : {} });
  },
);
