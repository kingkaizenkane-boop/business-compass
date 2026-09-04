import { Link, useRouter } from "@tanstack/react-router";
import { AlertTriangle, LogIn, RotateCcw, SearchX } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { reportLovableError } from "@/lib/lovable-error-reporting";

/**
 * The in-place failure surface for every route.
 *
 * Registered as the router's default error component, so a failed read renders
 * a calm explanation with a retry inside the surrounding layout instead of
 * blanking the page. Session expiry is detected and routed to sign-in, because
 * "sign in again" is the only useful action in that case.
 */

function isSessionError(message: string) {
  return /unauthor|not authenticated|jwt|session|expired|401/i.test(message);
}

export function RouteErrorState({ error, reset }: { error: Error; reset?: () => void }) {
  const router = useRouter();
  const message = error?.message ?? "";
  const expired = isSessionError(message);

  useEffect(() => {
    reportLovableError(error, { boundary: "route_error_component" });
  }, [error]);

  return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-4 rounded-xl border border-border bg-card px-6 py-8">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {expired ? <LogIn className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
      </span>
      <div className="space-y-1.5">
        <h2 className="font-serif text-2xl leading-tight text-foreground">
          {expired ? "Your session has ended" : "This didn't load"}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {expired
            ? "You were signed out, so this page couldn't read your business data. Sign in again and you'll come straight back to where you were."
            : "We couldn't read your business data just now. Nothing has been lost — try again, and if it keeps failing come back in a moment."}
        </p>
        {!expired && message ? (
          <p className="pt-1 font-mono text-xs leading-relaxed text-muted-foreground/80">{message}</p>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {expired ? (
          <Button asChild size="sm">
            <Link to="/auth">Sign in</Link>
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => {
              void router.invalidate();
              reset?.();
            }}
          >
            <RotateCcw className="mr-2 h-3.5 w-3.5" />
            Try again
          </Button>
        )}
        <Button asChild size="sm" variant="outline">
          <Link to="/app/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}

export function RouteNotFoundState() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-4 rounded-xl border border-border bg-card px-6 py-8">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <SearchX className="h-4 w-4" />
      </span>
      <div className="space-y-1.5">
        <h2 className="font-serif text-2xl leading-tight text-foreground">We couldn't find that</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The page or record you asked for doesn't exist, or it belongs to another business.
        </p>
      </div>
      <Button asChild size="sm" variant="outline">
        <Link to="/app/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}
