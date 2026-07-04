import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — BuildHub" },
      {
        name: "description",
        content:
          "How BuildHub collects, uses, stores, and protects your personal data — including account info, posted content, and device usage.",
      },
      { property: "og:title", content: "Privacy Policy — BuildHub" },
      {
        property: "og:description",
        content: "How BuildHub collects, uses, and protects your personal data.",
      },
      { property: "og:url", content: "https://buildhubkh.com/privacy" },
      { property: "og:type", content: "article" },
    ],
    links: [{ rel: "canonical", href: "https://buildhubkh.com/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background pb-10">
      <header className="sticky top-0 z-30 flex h-14 items-center bg-primary px-3 text-primary-foreground">
        <button
          onClick={() => navigate({ to: "/settings" })}
          className="rounded-full p-2 active:bg-white/10"
          aria-label={t("back_label")}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-center text-base font-semibold">{t("privacy")}</h1>
        <span className="w-9" />
      </header>

      <main className="mx-auto max-w-2xl space-y-5 px-4 py-5 text-sm leading-relaxed text-foreground">
        <p className="text-xs text-muted-foreground">{t("last_updated_april_2026")}</p>

        {lang === "km" ? <>
          <Section title="១. ទិន្នន័យដែលយើងប្រមូល">ព័ត៌មានគណនី ព័ត៌មានប្រវត្តិរូប មាតិកាដែលអ្នកបង្ហោះ និងទិន្នន័យមូលដ្ឋានអំពីឧបករណ៍ និងការប្រើប្រាស់។</Section>
          <Section title="២. របៀបប្រើទិន្នន័យ">ដើម្បីផ្តល់ និងកែលម្អសេវា ផ្គូផ្គងអ្នកជំនាញ និងអតិថិជន បើកការផ្ញើសារ បង្ហាញការដំណឹង ទប់ស្កាត់ការបោកប្រាស់ និងគោរពកាតព្វកិច្ចច្បាប់។</Section>
          <Section title="៣. ការចែករំលែក">ព័ត៌មានប្រវត្តិរូប និងមាតិកាដែលបានបង្ហោះអាចមើលឃើញដោយអ្នកប្រើផ្សេង។ យើងមិនលក់ទិន្នន័យផ្ទាល់ខ្លួនទេ ហើយចែករំលែកតែជាមួយអ្នកផ្តល់សេវាដែលមានកាតព្វកិច្ចរក្សាការសម្ងាត់ ឬតាមតម្រូវការច្បាប់។</Section>
          <Section title="៤. ការរក្សាទុក និងសុវត្ថិភាព">ទិន្នន័យត្រូវបានរក្សាទុកលើហេដ្ឋារចនាសម្ព័ន្ធក្លោដដែលមានការគ្រប់គ្រងការចូលប្រើ។ ទោះយើងប្រើវិធានការសមស្រប ក៏គ្មានប្រព័ន្ធណាមានសុវត្ថិភាព ១០០% ទេ។</Section>
          <Section title="៥. សិទ្ធិរបស់អ្នក">អ្នកអាចកែប្រវត្តិរូប លុបការបង្ហោះ ឬស្នើលុបគណនីតាមការកំណត់។ សូមទាក់ទងយើងដើម្បីស្នើចូលមើល ឬកែទិន្នន័យ។</Section>
          <Section title="៦. ខូគី និងការរក្សាទុកក្នុងឧបករណ៍">យើងប្រើខូគី និងការរក្សាទុកក្នុងឧបករណ៍ ដើម្បីរក្សាការចូលគណនី និងចងចាំចំណូលចិត្តដូចជាភាសា។</Section>
          <Section title="៧. កុមារ">BuildHub មិនមានបំណងសម្រាប់អ្នកអាយុក្រោម ១៨ ឆ្នាំទេ ហើយយើងមិនប្រមូលទិន្នន័យពីអនីតិជនដោយចេតនាទេ។</Section>
          <Section title="៨. ការផ្លាស់ប្តូរ">យើងអាចកែប្រែគោលការណ៍នេះ ហើយនឹងដំណឹងអំពីការផ្លាស់ប្តូរសំខាន់ៗតាមកម្មវិធី។</Section>
          <Section title="៩. ទំនាក់ទំនង">មានសំណួរអំពីឯកជនភាព? សូមចូលទៅ ការកំណត់ → រាយការណ៍បញ្ហា។</Section>
        </> : <>
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
        </>}
      </main>
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
