import { createFileRoute, notFound } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { getPublishedSeoPage } from "@/lib/seo-public.functions";

export const Route = createFileRoute("/business-os-for/$slug")({
  loader: async ({ params }) => {
    const page = await getPublishedSeoPage({ data: { siteType: "platform", slug: params.slug } });
    if (!page) throw notFound();
    return page;
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return {};
    const url = loaderData.canonicalUrl;
    return {
      meta: [
        { title: loaderData.metaTitle },
        { name: "description", content: loaderData.metaDescription },
        { property: "og:title", content: loaderData.metaTitle },
        { property: "og:description", content: loaderData.metaDescription },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url || `https://ops-intellipro.lovable.app/business-os-for/${params.slug}` }],
      ...(loaderData.schema
        ? { scripts: [{ type: "application/ld+json", children: loaderData.schema }] }
        : {}),
    };
  },
  component: PlatformLandingPage,
});

function PlatformLandingPage() {
  const page = Route.useLoaderData();
  const content = page.content;

  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <article className="space-y-10">
        <header>
          <p className="eyebrow">Business OS</p>
          <h1 className="display-lg mt-3 text-foreground">{page.h1}</h1>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">{content.intro}</p>
        </header>

        {content.sections.map((section) => (
          <section key={section.key}>
            <h2 className="text-2xl text-foreground">{section.heading}</h2>
            <p className="mt-3 whitespace-pre-line leading-relaxed text-muted-foreground">{section.body}</p>
          </section>
        ))}

        {content.faq.length > 0 ? (
          <section>
            <h2 className="text-2xl text-foreground">Common questions</h2>
            <dl className="mt-4 space-y-5">
              {content.faq.map((item) => (
                <div key={item.question}>
                  <dt className="text-foreground">{item.question}</dt>
                  <dd className="mt-1.5 leading-relaxed text-muted-foreground">{item.answer}</dd>
                </div>
              ))}
            </dl>
          </section>
        ) : null}

        <footer className="border-t border-border pt-8">
          <Button asChild size="lg">
            <Link to="/auth">{content.cta.label}</Link>
          </Button>
          {content.cta.note ? (
            <p className="mt-3 text-xs text-muted-foreground">{content.cta.note}</p>
          ) : null}
        </footer>
      </article>
    </main>
  );
}
