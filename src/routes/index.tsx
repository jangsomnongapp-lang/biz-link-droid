import { createFileRoute } from "@tanstack/react-router";
import Welcome from "@/components/screens/Welcome";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BuildHub — Find Construction Work and Workers in Cambodia" },
      {
        name: "description",
        content:
          "BuildHub is Cambodia's mobile marketplace for construction. Post projects, find skilled workers and teams, and discover material suppliers — in Khmer and English.",
      },
      { property: "og:title", content: "BuildHub — Find Construction Work and Workers in Cambodia" },
      {
        property: "og:description",
        content:
          "Cambodia's mobile marketplace for construction. Post projects, find workers, and discover suppliers.",
      },
      { property: "og:url", content: "https://buildhubkh.com/" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://buildhubkh.com/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "BuildHub",
          url: "https://buildhubkh.com/",
          inLanguage: ["km", "en"],
          potentialAction: {
            "@type": "SearchAction",
            target: "https://buildhubkh.com/search?q={search_term_string}",
            "query-input": "required name=search_term_string",
          },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "BuildHub",
          url: "https://buildhubkh.com/",
          logo: "https://buildhubkh.com/og-image-v2.png",
          description:
            "Mobile marketplace connecting construction workers, teams, suppliers, and clients across Cambodia.",
        }),
      },
    ],
  }),
  component: Welcome,
});
