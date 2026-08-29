import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageHeader, SectionLabel, StatBlock } from "@/components/business-os/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getSeoPage, recordSeoMeasurement, saveSeoPage, setSeoPageStatus } from "@/lib/seo.functions";
import { PAGE_STATUS_LABELS, QUALITY_THRESHOLD, scoreTone } from "@/lib/seo-types";

export const Route = createFileRoute("/_authenticated/app/seo/pages/$pageId")({
  head: () => ({
    meta: [
      { title: "SEO Page Review — Business OS" },
      {
        name: "description",
        content:
          "Review a generated page against its quality report and the Business Brain evidence behind every factual claim before publishing.",
      },
      { property: "og:title", content: "SEO Page Review — Business OS" },
      {
        property: "og:description",
        content: "Quality report, evidence, version history and measured results for one generated page.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PageReview,
});

const TONE = {
  good: "border-positive/40 text-positive",
  warn: "border-caution/50 text-caution-foreground",
  bad: "border-destructive/40 text-destructive",
} as const;

function PageReview() {
  const { pageId } = Route.useParams();
  const queryClient = useQueryClient();

  const fetchPage = useServerFn(getSeoPage);
  const persist = useServerFn(saveSeoPage);
  const changeStatus = useServerFn(setSeoPageStatus);
  const measure = useServerFn(recordSeoMeasurement);

  const queryKey = ["seo-page", pageId];
  const { data: page, isLoading } = useQuery({
    queryKey,
    queryFn: () => fetchPage({ data: { pageId } }),
  });

  const [title, setTitle] = useState("");
  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [measurement, setMeasurement] = useState("");

  useEffect(() => {
    if (!page) return;
    setTitle(page.title ?? "");
    setMetaTitle(page.metaTitle ?? "");
    setMetaDescription(page.metaDescription ?? "");
  }, [page]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey });
    void queryClient.invalidateQueries({ queryKey: ["seo-overview"] });
  };

  const save = useMutation({
    mutationFn: () => persist({ data: { pageId, title, metaTitle, metaDescription } }),
    onSuccess: () => {
      toast.success("Page updated and re-scored.");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const status = useMutation({
    mutationFn: (next: "draft" | "review" | "approved" | "published" | "paused" | "archived") =>
      changeStatus({ data: { pageId, status: next } }),
    onSuccess: (result) => {
      if (result.ok) toast.success("Status updated.");
      else toast.error(result.reason ?? "That change was blocked.");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addMeasurement = useMutation({
    mutationFn: () =>
      measure({
        data: { pageId, metricKey: "organic_visits", value: Number(measurement), source: "manual" },
      }),
    onSuccess: () => {
      toast.success("Measurement recorded.");
      setMeasurement("");
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading || !page) {
    return <div className="p-2 text-sm text-muted-foreground">Loading page…</div>;
  }

  const quality = page.quality;

  return (
    <div className="space-y-8">
      <Link to="/app/seo/library" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3" aria-hidden /> Back to page library
      </Link>

      <PageHeader
        eyebrow={PAGE_STATUS_LABELS[page.status]}
        title={page.title ?? page.slug}
        subtitle={page.path}
        actions={
          <div className="flex flex-wrap gap-2">
            {page.status === "draft" ? (
              <Button variant="outline" onClick={() => status.mutate("review")} disabled={status.isPending}>
                Send to review
              </Button>
            ) : null}
            {page.status === "review" ? (
              <Button variant="outline" onClick={() => status.mutate("approved")} disabled={status.isPending}>
                Approve
              </Button>
            ) : null}
            {page.status === "approved" ? (
              <Button onClick={() => status.mutate("published")} disabled={status.isPending}>
                Publish
              </Button>
            ) : null}
            {page.status === "published" ? (
              <Button variant="outline" onClick={() => status.mutate("paused")} disabled={status.isPending}>
                Pause
              </Button>
            ) : null}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost">Evidence</Button>
              </SheetTrigger>
              <SheetContent className="w-full overflow-y-auto sm:max-w-md">
                <SheetHeader>
                  <SheetTitle>Evidence behind this page</SheetTitle>
                  <SheetDescription>
                    Every factual claim traces to a Business Brain fact. Unsupported claims are blocked.
                  </SheetDescription>
                </SheetHeader>
                <ul className="mt-6 space-y-3">
                  {page.evidence.length === 0 ? (
                    <li className="text-sm text-muted-foreground">No facts linked to this page yet.</li>
                  ) : (
                    page.evidence.map((fact) => (
                      <li key={fact.id} className="rounded-lg border border-border bg-card p-4">
                        <p className="eyebrow">{fact.category}</p>
                        <p className="mt-1 text-sm text-foreground">{fact.value}</p>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {fact.factKey} · {fact.verified ? "Verified" : "Unverified"}
                        </p>
                      </li>
                    ))
                  )}
                </ul>
              </SheetContent>
            </Sheet>
          </div>
        }
      />

      {quality ? (
        <section>
          <SectionLabel aside={`Publishable at ${QUALITY_THRESHOLD}/100`}>Quality report</SectionLabel>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatBlock label="Overall" value={`${quality.score}`} caption={quality.publishable ? "Passes the gate." : "Blocked from publishing."} />
            <StatBlock label="Originality" value={`${quality.originality}`} caption="Distance from every other page on this site." />
            <StatBlock label="Business relevance" value={`${quality.businessRelevance}`} caption="Overlap with your verified Brain facts." />
            <StatBlock label="Factual confidence" value={`${quality.factualConfidence}`} caption={`${quality.wordCount} words written.`} />
          </div>

          <ul className="mt-4 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
            {quality.checks.map((check) => (
              <li key={check.key} className="bg-card p-4">
                <div className="flex items-start gap-2">
                  <span className={check.passed ? "text-positive" : "text-destructive"}>
                    {check.passed ? <Check className="size-4" aria-hidden /> : <X className="size-4" aria-hidden />}
                  </span>
                  <div>
                    <p className="text-sm text-foreground">
                      {check.label}
                      {check.blocking ? (
                        <Badge variant="outline" className="ml-2 rounded-full text-[0.65rem] font-normal text-muted-foreground">
                          Blocking
                        </Badge>
                      ) : null}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{check.detail}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <SectionLabel>Metadata</SectionLabel>
        <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-quiet">
          <div>
            <label className="eyebrow" htmlFor="page-title">
              Title
            </label>
            <Input id="page-title" value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2" />
          </div>
          <div>
            <label className="eyebrow" htmlFor="page-meta-title">
              Meta title
            </label>
            <Input
              id="page-meta-title"
              value={metaTitle}
              onChange={(event) => setMetaTitle(event.target.value)}
              className="mt-2"
            />
          </div>
          <div>
            <label className="eyebrow" htmlFor="page-meta-description">
              Meta description
            </label>
            <Textarea
              id="page-meta-description"
              value={metaDescription}
              onChange={(event) => setMetaDescription(event.target.value)}
              className="mt-2"
              rows={3}
            />
          </div>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save and re-score"}
          </Button>
        </div>
      </section>

      {page.content ? (
        <section>
          <SectionLabel aside={`Version ${page.version}`}>Content</SectionLabel>
          <article className="space-y-6 rounded-xl border border-border bg-card p-6 shadow-quiet">
            <h2 className="text-2xl text-foreground">{page.h1 ?? page.title}</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">{page.content.intro}</p>
            {page.content.sections.map((section) => (
              <div key={section.key}>
                <h3 className="text-lg text-foreground">{section.heading}</h3>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{section.body}</p>
              </div>
            ))}
            {page.content.faq.length > 0 ? (
              <div>
                <p className="eyebrow">Questions</p>
                <dl className="mt-3 space-y-4">
                  {page.content.faq.map((item) => (
                    <div key={item.question}>
                      <dt className="text-sm text-foreground">{item.question}</dt>
                      <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.answer}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ) : null}
          </article>
        </section>
      ) : null}

      <section>
        <SectionLabel aside="Recorded, never estimated">Measured results</SectionLabel>
        <div className="rounded-xl border border-border bg-card p-5 shadow-quiet">
          {page.measurements.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No results recorded for this page yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {page.measurements.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-foreground">{row.metricKey.replace(/_/g, " ")}</span>
                  <span className="numeric text-muted-foreground">
                    {row.value.toLocaleString()} · {row.source}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {page.status === "published" ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <Input
                value={measurement}
                onChange={(event) => setMeasurement(event.target.value)}
                placeholder="Organic visits"
                inputMode="numeric"
                aria-label="Organic visits"
                className="max-w-[12rem]"
              />
              <Button
                variant="outline"
                onClick={() => addMeasurement.mutate()}
                disabled={!measurement || Number.isNaN(Number(measurement)) || addMeasurement.isPending}
              >
                Record
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      {page.versions.length > 0 ? (
        <section>
          <SectionLabel>Version history</SectionLabel>
          <ul className="space-y-2">
            {page.versions.map((version) => (
              <li
                key={version.version}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 text-sm shadow-quiet"
              >
                <span className="text-foreground">
                  v{version.version} · {version.title ?? "Untitled"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {version.status ?? "—"} ·{" "}
                  <span className={TONE[scoreTone(version.qualityScore)]}>{version.qualityScore ?? "—"}/100</span> ·{" "}
                  {new Date(version.createdAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
