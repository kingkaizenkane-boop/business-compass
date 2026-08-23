import { Link, createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";

import { LoopDiagram } from "@/components/business-os/loop-diagram";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BLUEPRINT_SECTIONS, DIAGNOSIS_CATEGORIES } from "@/lib/business-os";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Business OS — Your business shouldn't live inside your head" },
      {
        name: "description",
        content:
          "Business OS learns how your business works, identifies what's holding it back, and turns that knowledge into a practical operating and growth plan.",
      },
      { property: "og:title", content: "Business OS — Your business shouldn't live inside your head" },
      {
        property: "og:description",
        content:
          "Understand what's really happening in your business, then turn it into a blueprint and a 90-day plan.",
      },
    ],
  }),
  component: LandingPage,
});

const PROBLEMS = [
  {
    title: "The business runs on memory",
    body: "How you price, who your best customers are, why work slips — it lives in your head, not in a system anyone else can run.",
  },
  {
    title: "Advice arrives generic",
    body: "Templates and courses describe businesses in general. They don't know your numbers, your bottleneck or your market.",
  },
  {
    title: "Effort goes to the wrong place",
    body: "Most owners work hard on the second or third most important problem, because nothing tells them which one is first.",
  },
];

const CAPABILITIES = [
  {
    eyebrow: "Business Brain",
    title: "A structured model of your business",
    body: "Facts, not vibes. Every entry carries a value, a source, a confidence level and a verification status — and versions itself when it changes.",
    to: "/app/brain",
    cta: "See the Brain",
  },
  {
    eyebrow: "Diagnosis",
    title: "Where the constraint actually is",
    body: `Scored across ${DIAGNOSIS_CATEGORIES.length} areas — revenue, conversion, retention, automation, owner dependency and more — with the reasoning shown.`,
    to: "/app/diagnosis",
    cta: "See the diagnosis",
  },
  {
    eyebrow: "Blueprint",
    title: "A strategy you could hand to someone",
    body: `${BLUEPRINT_SECTIONS.length} sections covering positioning, offer, pricing, acquisition, retention, operating model and your own role in it.`,
    to: "/app/blueprint",
    cta: "See the blueprint",
  },
  {
    eyebrow: "Action plan",
    title: "The next 90 days, sequenced",
    body: "Each action states its expected impact, its effort, its owner and its dependencies. Nothing runs in your business without your approval.",
    to: "/app/action-plan",
    cta: "See the plan",
  },
];

const INDUSTRIES = [
  { name: "Barber studio", constraint: "Weak weekday demand, low rebooking" },
  { name: "House painting company", constraint: "Slow quotes, leaky lead follow-up" },
  { name: "Immigration law firm", constraint: "Manual onboarding, owner dependency" },
];

const FAQS = [
  {
    q: "Is this a chatbot?",
    a: "No. The conversation is how the system learns. The product is the structured understanding it builds — and what it does with it: diagnosis, blueprint, plan, measurement.",
  },
  {
    q: "How long does the discovery interview take?",
    a: "It adapts to your business rather than running a fixed question count. You can pause at any point and return days later to exactly where you stopped.",
  },
  {
    q: "What if I don't know a number?",
    a: "Say so. It becomes a pending item you can come back to, and the system tells you which missing numbers actually change its conclusions.",
  },
  {
    q: "Will it invent things about my business?",
    a: "Anything inferred is labelled as inference and never presented as fact. If new information contradicts what was recorded, you decide which version is right.",
  },
  {
    q: "Does it give legal or regulated advice?",
    a: "It organises, summarises and drafts. For regulated professional advice, a qualified human stays in the approval seat.",
  },
];

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
          <Link to="/" className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" aria-hidden />
            <span className="text-sm font-semibold tracking-[0.14em]">BUSINESS OS</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/app/help">See how it works</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/business/new">Build My Business Blueprint</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border">
          <div className="rule-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden />
          <div className="relative mx-auto w-full max-w-6xl px-5 py-24 md:py-32">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-3xl"
            >
              <p className="eyebrow">Business intelligence, strategy and operating system</p>
              <h1 className="display-xl mt-5 text-foreground">
                Your business shouldn't live inside your head.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
                Business OS learns how your business works, identifies what's holding it back, and
                turns that knowledge into a practical operating and growth plan.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Button asChild size="lg">
                  <Link to="/business/new">
                    Build My Business Blueprint
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/app/help">See how it works</Link>
                </Button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Problem */}
        <section className="border-b border-border bg-surface">
          <div className="mx-auto w-full max-w-6xl px-5 py-20">
            <p className="eyebrow">The problem</p>
            <h2 className="display-lg mt-4 max-w-2xl text-foreground">
              Most small businesses aren't short of effort. They're short of clarity.
            </h2>
            <ul className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
              {PROBLEMS.map((problem) => (
                <li key={problem.title} className="bg-card p-7">
                  <h3 className="text-lg text-foreground">{problem.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {problem.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How it works */}
        <section className="border-b border-border">
          <div className="mx-auto w-full max-w-6xl px-5 py-20">
            <p className="eyebrow">How it works</p>
            <h2 className="display-lg mt-4 max-w-2xl text-foreground">One loop, running as long as you run the business.</h2>
            <p className="mt-4 max-w-2xl text-[0.975rem] leading-relaxed text-muted-foreground">
              Each pass through the loop makes the system's understanding more specific and its
              recommendations more useful. On day one it knows your basics. By day ninety it knows
              your patterns.
            </p>
            <div className="mt-12">
              <LoopDiagram />
            </div>
          </div>
        </section>

        {/* Capabilities */}
        <section className="border-b border-border bg-surface">
          <div className="mx-auto w-full max-w-6xl px-5 py-20">
            <p className="eyebrow">What you get</p>
            <h2 className="display-lg mt-4 max-w-2xl text-foreground">
              Understand what's really happening, then act on it.
            </h2>
            <div className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-2">
              {CAPABILITIES.map((item) => (
                <article key={item.eyebrow} className="flex flex-col bg-card p-8">
                  <p className="eyebrow">{item.eyebrow}</p>
                  <h3 className="mt-3 text-xl text-foreground">{item.title}</h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {item.body}
                  </p>
                  <Link
                    to={item.to}
                    className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {item.cta}
                    <ArrowRight className="size-3.5" aria-hidden />
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* SEO engine */}
        <section className="border-b border-border">
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-20 md:grid-cols-2">
            <div>
              <p className="eyebrow">SEO engine</p>
              <h2 className="display-lg mt-4 text-foreground">
                Pages worth publishing, about work you actually do.
              </h2>
              <p className="mt-4 text-[0.975rem] leading-relaxed text-muted-foreground">
                Business OS only generates a page when your Business Brain holds enough real
                information to support it — your services, your locations, your expertise. Every page
                clears a quality gate before anyone sees it, and nothing thin gets published
                automatically.
              </p>
              <Button asChild variant="outline" className="mt-7">
                <Link to="/app/seo">Open the SEO engine</Link>
              </Button>
            </div>
            <ul className="grid gap-px self-start overflow-hidden rounded-xl border border-border bg-border">
              {[
                "Beard grooming in Ikeja",
                "Interior painter in Lekki",
                "Exterior painting quotes in Surulere",
              ].map((example) => (
                <li key={example} className="bg-card p-5 text-sm text-foreground">
                  {example}
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Generated from services and locations held in the Brain
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Industries */}
        <section className="border-b border-border bg-surface">
          <div className="mx-auto w-full max-w-6xl px-5 py-20">
            <p className="eyebrow">Industry-agnostic by design</p>
            <h2 className="display-lg mt-4 max-w-2xl text-foreground">
              The same architecture, a different business every time.
            </h2>
            <ul className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-3">
              {INDUSTRIES.map((industry) => (
                <li key={industry.name} className="bg-card p-7">
                  <h3 className="text-lg text-foreground">{industry.name}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    Typical constraint: {industry.constraint}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-b border-border">
          <div className="mx-auto w-full max-w-3xl px-5 py-20">
            <p className="eyebrow">Questions</p>
            <h2 className="display-lg mt-4 text-foreground">Before you start</h2>
            <Accordion type="single" collapsible className="mt-10">
              {FAQS.map((faq) => (
                <AccordionItem key={faq.q} value={faq.q}>
                  <AccordionTrigger className="text-left text-base">{faq.q}</AccordionTrigger>
                  <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-ink text-ink-foreground">
          <div className="mx-auto w-full max-w-4xl px-5 py-24 text-center">
            <h2 className="display-lg text-ink-foreground">
              Turn your expertise into a system.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-[0.975rem] leading-relaxed opacity-80">
              Start with the basics of your business. Twenty minutes of discovery is enough to
              produce a diagnosis you can act on this week.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" variant="secondary">
                <Link to="/business/new">Build My Business Blueprint</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="ghost"
                className="text-ink-foreground hover:bg-ink-foreground/10"
              >
                <Link to="/app/help">See how it works</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-xs text-muted-foreground">
          <span className="font-semibold tracking-[0.14em]">BUSINESS OS</span>
          <span>Clarity, structure and execution for small businesses.</span>
        </div>
      </footer>
    </div>
  );
}
