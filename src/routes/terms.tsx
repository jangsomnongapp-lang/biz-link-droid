import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — BuildHub" },
      { name: "description", content: "Read the BuildHub terms and conditions for using the platform." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="sticky top-0 z-30 flex h-14 items-center bg-primary px-3 text-primary-foreground">
        <button
          onClick={() => navigate({ to: "/settings" })}
          className="rounded-full p-2 active:bg-white/10"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-center text-base font-semibold">{t("terms")}</h1>
        <span className="w-9" />
      </header>

      <article className="mx-auto max-w-2xl space-y-5 px-4 py-5 text-sm leading-relaxed text-foreground">
        <p className="text-xs text-muted-foreground">Last updated: April 2026</p>

        <Section title="1. Acceptance of terms">
          By creating an account or using BuildHub, you agree to these Terms & Conditions.
          If you do not agree, please do not use the app.
        </Section>

        <Section title="2. Eligibility">
          You must be at least 18 years old and legally able to enter contracts to use the
          platform. You are responsible for the accuracy of the information you provide.
        </Section>

        <Section title="3. Accounts & security">
          Keep your password confidential. You are responsible for activity under your account.
          Notify us immediately if you suspect unauthorized access.
        </Section>

        <Section title="4. User content">
          You retain ownership of content you post (projects, posts, profile info). By posting,
          you grant BuildHub a non-exclusive license to display it on the platform. You must not
          post illegal, abusive, misleading, or infringing content.
        </Section>

        <Section title="5. Jobs, projects & payments">
          BuildHub connects clients and workers. Any agreement, payment, or work performed is
          strictly between the parties involved. BuildHub is not a party to those contracts and
          is not responsible for the quality, safety, or legality of work, listings, or payments.
        </Section>

        <Section title="6. Prohibited conduct">
          No spam, harassment, fraud, scraping, or attempts to bypass security. Violations may
          result in content removal or account suspension.
        </Section>

        <Section title="7. Moderation">
          We may review, edit, or remove content that violates these terms or applicable laws,
          and suspend accounts at our discretion.
        </Section>

        <Section title="8. Disclaimer">
          The service is provided "as is" without warranties of any kind. We do not guarantee
          uninterrupted or error-free operation.
        </Section>

        <Section title="9. Limitation of liability">
          To the maximum extent permitted by law, BuildHub is not liable for indirect,
          incidental, or consequential damages arising from use of the platform.
        </Section>

        <Section title="10. Changes">
          We may update these terms from time to time. Continued use after changes means you
          accept the updated terms.
        </Section>

        <Section title="11. Contact">
          Questions about these terms? Reach us through Settings → Report a problem.
        </Section>
      </article>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-1 text-sm font-bold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">{children}</p>
    </section>
  );
}
