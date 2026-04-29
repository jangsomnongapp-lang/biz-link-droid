import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — BuildHub" },
      { name: "description", content: "How BuildHub collects, uses, and protects your personal data." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
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
        <h1 className="flex-1 text-center text-base font-semibold">{t("privacy")}</h1>
        <span className="w-9" />
      </header>

      <article className="mx-auto max-w-2xl space-y-5 px-4 py-5 text-sm leading-relaxed text-foreground">
        <p className="text-xs text-muted-foreground">Last updated: April 2026</p>

        <Section title="1. What we collect">
          Account info (name, phone, email), profile details (avatar, specialties, organization),
          content you post (projects, posts, comments, messages), and basic device/usage data.
        </Section>

        <Section title="2. How we use your data">
          To provide and improve the service, match workers and clients, enable messaging,
          show notifications, prevent fraud and abuse, and comply with legal obligations.
        </Section>

        <Section title="3. Sharing">
          Profile info and posted content are visible to other users of the platform. We do not
          sell your personal data. We may share data with service providers (hosting, auth) under
          confidentiality obligations, or when required by law.
        </Section>

        <Section title="4. Storage & security">
          Data is stored on secured cloud infrastructure with access controls. While we use
          reasonable safeguards, no system is 100% secure.
        </Section>

        <Section title="5. Your rights">
          You can edit your profile, delete your posts, or request account deletion from
          Settings. Contact us for data access or correction requests.
        </Section>

        <Section title="6. Cookies & local storage">
          We use cookies and local storage to keep you signed in and remember preferences such
          as language.
        </Section>

        <Section title="7. Children">
          BuildHub is not intended for users under 18. We do not knowingly collect data from
          minors.
        </Section>

        <Section title="8. Changes">
          We may update this policy. Material changes will be communicated through the app.
        </Section>

        <Section title="9. Contact">
          Privacy questions? Reach us through Settings → Report a problem.
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
