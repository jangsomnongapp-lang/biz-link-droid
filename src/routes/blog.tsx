import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/blog")({
  head: () => ({
    meta: [
      { title: "BuildHub Blog — Construction Tips & Market News for Cambodia" },
      {
        name: "description",
        content:
          "Practical construction guides, materials advice, cost updates, and safety tips for building in Cambodia.",
      },
      {
        property: "og:title",
        content: "BuildHub Blog — Construction Tips & Market News for Cambodia",
      },
      {
        property: "og:description",
        content:
          "Practical construction guides, materials advice, cost updates, and safety tips for building in Cambodia.",
      },
      { property: "og:url", content: "https://buildhubkh.com/blog" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://buildhubkh.com/blog" }],
  }),
  component: BlogLayout,
});

function BlogLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 flex h-14 items-center bg-primary px-3 text-primary-foreground">
        <Link to="/" className="rounded-full p-2 active:bg-white/10" aria-label="Back to home">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="flex-1 text-center text-base font-semibold">BuildHub Blog</h1>
        <span className="w-9" />
      </header>

      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
