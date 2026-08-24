import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Business OS" },
      {
        name: "description",
        content:
          "Sign in to Business OS to continue your Business DNA interview, review your Brain and act on your plan.",
      },
      { property: "og:title", content: "Sign in — Business OS" },
      {
        property: "og:description",
        content: "Continue where you left off in your business operating system.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active && data.session) void navigate({ to: "/app/dashboard" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        void navigate({ to: "/reset-password" });
        return;
      }
      if (event === "SIGNED_IN" && session) void navigate({ to: "/app/dashboard" });
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  async function handleGoogle() {
    setBusy(true);
    try {
      await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("If that email has an account, a reset link is on its way.");
        setMode("signin");
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("Account created. Check your inbox if confirmation is required.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const heading =
    mode === "signin" ? "Welcome back." : mode === "signup" ? "Create your account." : "Reset your password.";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-sm">
        <p className="eyebrow">Business OS</p>
        <h1 className="mt-2 font-serif text-3xl leading-tight text-foreground">{heading}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {mode === "forgot"
            ? "We'll email you a link to choose a new password."
            : "Your interview, Brain and plan stay exactly where you left them."}
        </p>

        {mode !== "forgot" ? (
          <>
            <Button
              type="button"
              variant="outline"
              className="mt-7 w-full"
              disabled={busy}
              onClick={() => void handleGoogle()}
            >
              Continue with Google
            </Button>
            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs uppercase tracking-wide text-muted-foreground">or</span>
              <span className="h-px flex-1 bg-border" />
            </div>
          </>
        ) : null}

        <form onSubmit={handleSubmit} className={mode === "forgot" ? "mt-7 space-y-4" : "space-y-4"}>
          {mode === "signup" ? (
            <div className="space-y-1.5">
              <Label htmlFor="full-name">Your name</Label>
              <Input
                id="full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
              />
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
          {mode !== "forgot" ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {mode === "signin" ? (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                    onClick={() => setMode("forgot")}
                  >
                    Forgot password?
                  </button>
                ) : null}
              </div>
              <Input
                id="password"
                type="password"
                required
                minLength={mode === "signup" ? 8 : 6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
              {mode === "signup" ? (
                <p className="text-xs text-muted-foreground">At least 8 characters.</p>
              ) : null}
            </div>
          ) : null}
          <Button type="submit" className="w-full" disabled={busy}>
            {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Email me a reset link"}
          </Button>
        </form>

        <button
          type="button"
          className="mt-5 text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "No account yet? Create one" : "Already have an account? Sign in"}
        </button>
      </div>
    </main>
  );
}
