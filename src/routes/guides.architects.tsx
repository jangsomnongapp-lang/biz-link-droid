import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/guides/architects")({
  head: () => ({
    meta: [
      { title: "How to Find and Hire an Architect in Cambodia — BuildHub" },
      {
        name: "description",
        content:
          "A practical guide to finding, vetting, and hiring an architect in Cambodia — fees, licensing, contracts, and where to find design professionals for your project.",
      },
      {
        property: "og:title",
        content: "How to Find and Hire an Architect in Cambodia — BuildHub",
      },
      {
        property: "og:description",
        content:
          "How to find, vet, and hire an architect in Cambodia: fees, licensing, contracts, and where to look.",
      },
      {
        property: "og:url",
        content: "https://buildhubkh.com/guides/architects",
      },
      { property: "og:type", content: "article" },
    ],
    links: [
      { rel: "canonical", href: "https://buildhubkh.com/guides/architects" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: "How to Find and Hire an Architect in Cambodia",
          description:
            "A practical guide to finding, vetting, and hiring an architect in Cambodia — fees, licensing, contracts, and where to look.",
          inLanguage: "en",
          about: "Hiring architects in Cambodia",
          author: { "@type": "Organization", name: "BuildHub" },
          publisher: {
            "@type": "Organization",
            name: "BuildHub",
            url: "https://buildhubkh.com/",
          },
          mainEntityOfPage: "https://buildhubkh.com/guides/architects",
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: [
            {
              "@type": "Question",
              name: "Do I need a licensed architect for a project in Cambodia?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "For most permitted buildings in Cambodia, drawings must be signed by an architect licensed by the Board of Architects Cambodia (BAC) before the Ministry of Land Management will approve a construction permit.",
              },
            },
            {
              "@type": "Question",
              name: "How much does an architect cost in Cambodia?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "Fees typically range from 3% to 8% of construction cost for full design services, or a fixed fee for small residential projects. Concept-only packages start lower; full documentation and site supervision cost more.",
              },
            },
            {
              "@type": "Question",
              name: "Where can I find architects in Cambodia?",
              acceptedAnswer: {
                "@type": "Answer",
                text: "You can find architects through the Board of Architects Cambodia registry, referrals from contractors, and marketplaces like BuildHub where design professionals list their services.",
              },
            },
          ],
        }),
      },
    ],
  }),
  component: ArchitectsGuidePage,
});

function ArchitectsGuidePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 flex h-14 items-center bg-primary px-3 text-primary-foreground">
        <Link
          to="/"
          className="rounded-full p-2 active:bg-white/10"
          aria-label="Back to home"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-center text-base font-semibold">
          Hiring an Architect in Cambodia
        </h1>
        <span className="w-9" />
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 py-6 text-foreground">
        <article className="prose prose-neutral max-w-none">
          <h1 className="mb-2 text-3xl font-extrabold tracking-tight">
            How to Find and Hire an Architect in Cambodia
          </h1>
          <p className="text-sm text-muted-foreground">
            A practical guide for owners, developers, and contractors
            commissioning design work in Phnom Penh, Siem Reap, Sihanoukville,
            and across the Kingdom.
          </p>

          <section className="mt-6 space-y-3">
            <h2 className="text-xl font-bold">Why hire an architect?</h2>
            <p>
              An architect turns a plot of land and a budget into a permitted,
              buildable design. In Cambodia's fast-growing construction market,
              a licensed architect protects your investment by producing
              drawings that meet the Ministry of Land Management, Urban
              Planning and Construction (MLMUPC) permit requirements, and by
              coordinating structural, MEP, and interior consultants so the
              site team can build without costly rework.
            </p>
            <p>
              For anything larger than a small single-storey house, hiring a
              professional pays for itself in permit approvals, buildability,
              energy performance in Cambodia's tropical climate, and resale
              value.
            </p>
          </section>

          <section className="mt-6 space-y-3">
            <h2 className="text-xl font-bold">
              Licensing and the Board of Architects Cambodia
            </h2>
            <p>
              Practising architects in Cambodia must be registered with the
              <strong> Board of Architects Cambodia (BAC)</strong>. For any
              project requiring a construction permit, drawings must be signed
              and stamped by a BAC-licensed architect before the Ministry will
              issue approval. Ask for the architect's BAC registration number
              and verify it before signing a contract.
            </p>
          </section>

          <section className="mt-6 space-y-3">
            <h2 className="text-xl font-bold">
              What architects charge in Cambodia
            </h2>
            <ul className="list-inside list-disc space-y-1">
              <li>
                <strong>Full design services</strong> (concept → construction
                documents → site supervision): typically 3–8% of construction
                cost.
              </li>
              <li>
                <strong>Concept + permit drawings only</strong>: fixed fee,
                often USD 1,500–8,000 for a villa depending on scope.
              </li>
              <li>
                <strong>Interior fit-out</strong>: fixed fee or 10–15% of
                fit-out cost.
              </li>
              <li>
                <strong>Site supervision</strong>: hourly, per-visit, or
                bundled into the design fee.
              </li>
            </ul>
            <p className="text-sm text-muted-foreground">
              Always confirm what's included: permit drawings, structural
              coordination, MEP, revisions, and site visits are the most
              commonly disputed line items.
            </p>
          </section>

          <section className="mt-6 space-y-3">
            <h2 className="text-xl font-bold">Where to find architects</h2>
            <ul className="list-inside list-disc space-y-1">
              <li>
                <strong>BuildHub</strong> — browse licensed design
                professionals and construction specialists on the marketplace.{" "}
                <Link
                  to="/find-worker"
                  className="font-semibold text-primary underline"
                >
                  Find a design professional
                </Link>
                .
              </li>
              <li>
                <strong>Board of Architects Cambodia</strong> — the official
                register of licensed architects.
              </li>
              <li>
                <strong>Referrals</strong> from your contractor, real-estate
                agent, or friends who recently built.
              </li>
              <li>
                <strong>Design studios</strong> in Phnom Penh and Siem Reap
                with published portfolios.
              </li>
            </ul>
          </section>

          <section className="mt-6 space-y-3">
            <h2 className="text-xl font-bold">How to vet an architect</h2>
            <ol className="list-inside list-decimal space-y-1">
              <li>Confirm BAC licence and years of practice in Cambodia.</li>
              <li>
                Ask for a portfolio of completed, permitted projects — not just
                renderings.
              </li>
              <li>
                Visit at least one finished project and one active site if
                possible.
              </li>
              <li>Check references with at least two former clients.</li>
              <li>
                Confirm they carry professional indemnity insurance for larger
                projects.
              </li>
              <li>
                Discuss how they coordinate with structural and MEP engineers.
              </li>
            </ol>
          </section>

          <section className="mt-6 space-y-3">
            <h2 className="text-xl font-bold">What to put in the contract</h2>
            <ul className="list-inside list-disc space-y-1">
              <li>Scope: concept, permit set, tender set, site supervision.</li>
              <li>Deliverables list with drawing types and revision counts.</li>
              <li>Fee schedule tied to milestones, not calendar dates alone.</li>
              <li>
                IP and drawing ownership — who can reuse the drawings after
                completion.
              </li>
              <li>Timeline with clear responsibility for permit delays.</li>
              <li>Dispute-resolution clause under Cambodian law.</li>
            </ul>
          </section>

          <section className="mt-6 space-y-3">
            <h2 className="text-xl font-bold">Typical design timeline</h2>
            <ul className="list-inside list-disc space-y-1">
              <li>Concept design: 2–4 weeks</li>
              <li>Schematic + permit drawings: 4–8 weeks</li>
              <li>Permit approval (MLMUPC): 1–3 months</li>
              <li>Tender + construction documentation: 4–10 weeks</li>
            </ul>
            <p className="text-sm text-muted-foreground">
              Plan for 3–6 months from first meeting to breaking ground on a
              typical residential project.
            </p>
          </section>

          <section className="mt-6 space-y-3">
            <h2 className="text-xl font-bold">Red flags</h2>
            <ul className="list-inside list-disc space-y-1">
              <li>Cannot produce a BAC licence number.</li>
              <li>Only shows renderings, no built work.</li>
              <li>
                Fees quoted as a lump sum with no breakdown of deliverables.
              </li>
              <li>
                Won't coordinate with a structural engineer or promises to
                "handle the permit informally."
              </li>
            </ul>
          </section>

          <section className="mt-8 rounded-2xl border border-border bg-surface p-5">
            <h2 className="text-lg font-bold">
              Find an architect on BuildHub
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              BuildHub connects owners, contractors, and design professionals
              across Cambodia. Post your project or browse licensed architects
              and specialists directly.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                to="/find-worker"
                className="flex h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground active:scale-[0.98]"
              >
                Find a design professional
              </Link>
              <Link
                to="/listings/new"
                className="flex h-11 items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-semibold text-foreground active:scale-[0.98]"
              >
                Post your project
              </Link>
            </div>
          </section>
        </article>
      </main>
    </div>
  );
}
