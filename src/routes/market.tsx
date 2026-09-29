import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { SuppliersListPage } from "./suppliers.index";

export const Route = createFileRoute("/market")({
  head: () => ({
    meta: [
      { title: "Rent Machinery & Buy Second Hand in Cambodia" },
      { name: "description", content: "Rent construction machinery, tools, and space, or buy and sell second-hand items across Cambodia on BuildHub." },
      { property: "og:title", content: "Rent Machinery & Buy Second Hand in Cambodia" },
      { property: "og:description", content: "Rent construction machinery, tools, and space, or buy and sell second-hand items across Cambodia." },
      { property: "og:url", content: "https://buildhubkh.com/market" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://buildhubkh.com/market" }],
  }),
  validateSearch: (params: Record<string, unknown>): { q?: string; mode?: "rent" | "secondhand" } => ({
    q: typeof params.q === "string" ? params.q.slice(0, 120) : undefined,
    mode: params.mode === "secondhand" ? "secondhand" : params.mode === "rent" ? "rent" : undefined,
  }),
  component: () => (
    <RequireAuth>
      <AppShell>
        <SuppliersListPage page="market" />
      </AppShell>
    </RequireAuth>
  ),
});
