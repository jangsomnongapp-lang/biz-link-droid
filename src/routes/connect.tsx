import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Copy, Check, ExternalLink, Bot } from "lucide-react";

export const Route = createFileRoute("/connect")({
  head: () => ({
    meta: [
      { title: "Connect BuildHub to ChatGPT or Claude — BuildHub" },
      {
        name: "description",
        content:
          "Connect BuildHub to ChatGPT, Claude, or other AI assistants so they can search projects, suppliers, and manage your listings on your behalf.",
      },
      { property: "og:title", content: "Connect BuildHub to your AI assistant" },
      {
        property: "og:description",
        content:
          "Step-by-step instructions to connect BuildHub as a tool source in ChatGPT and Claude.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ConnectPage,
});

function ConnectPage() {
  const [mcpUrl, setMcpUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMcpUrl(new URL("/mcp", window.location.origin).toString());
  }, []);

  async function copy() {
    if (!mcpUrl) return;
    try {
      await navigator.clipboard.writeText(mcpUrl);
      setCopied(true);
      toast.success("URL copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy — select and copy manually.");
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-16">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <Link to="/settings" className="-ml-2 rounded-full p-2 active:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-base font-semibold">Connect to an AI assistant</h1>
      </header>

      <main className="mx-auto w-full max-w-2xl space-y-6 px-4 py-6">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="mb-3 flex items-center gap-2 text-primary">
            <Bot className="h-5 w-5" />
            <p className="text-sm font-medium">
              Let ChatGPT, Claude, and other AI assistants use BuildHub as you.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            They can search construction listings, find suppliers, and post or manage your
            listings — always signed in as you.
          </p>
        </section>

        <section>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            BuildHub MCP server URL
          </label>
          <div className="flex items-stretch overflow-hidden rounded-xl border border-border bg-card">
            <input
              readOnly
              value={mcpUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 bg-transparent px-3 py-3 text-sm outline-none"
            />
            <button
              type="button"
              onClick={copy}
              className="flex items-center gap-1.5 border-l border-border bg-primary px-4 text-sm font-semibold text-primary-foreground active:scale-[0.98]"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            You'll paste this into your assistant. The first time you connect, you'll sign in
            to BuildHub and approve access.
          </p>
        </section>

        <ClientSection
          title="ChatGPT"
          steps={[
            <>
              Open{" "}
              <ExtLink href="https://chatgpt.com/#settings/Connectors/Advanced">
                ChatGPT → Settings → Connectors → Advanced
              </ExtLink>{" "}
              and turn on <b>Developer mode</b>. Read the risk notice ChatGPT shows before
              enabling.
            </>,
            <>
              Back in a chat, open the <b>+</b> menu in the message box and enable{" "}
              <b>Developer mode</b>.
            </>,
            <>
              Click <b>Add sources</b>, then <b>Connect more</b>.
            </>,
            <>
              Name the connector (e.g. <i>BuildHub</i>) and paste the URL above.
            </>,
            <>Ask ChatGPT to search or post BuildHub listings for you.</>,
          ]}
        />

        <ClientSection
          title="Claude"
          steps={[
            <>
              Open{" "}
              <ExtLink href="https://claude.ai/customize/connectors?modal=add-custom-connector">
                Claude → Add custom connector
              </ExtLink>
              .
            </>,
            <>
              Name the connector (e.g. <i>BuildHub</i>) and paste the URL above.
            </>,
            <>
              Enable the connector from the chat composer, then ask Claude to use BuildHub.
            </>,
          ]}
        />

        <p className="pt-2 text-center text-xs text-muted-foreground">
          On first use you'll be sent to BuildHub to sign in and approve the connection.
        </p>
      </main>
    </div>
  );
}

function ClientSection({ title, steps }: { title: string; steps: React.ReactNode[] }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <h2 className="mb-3 text-base font-semibold">{title}</h2>
      <ol className="space-y-3">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3 text-sm">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {i + 1}
            </span>
            <span className="leading-relaxed text-foreground">{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2"
    >
      {children}
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}
