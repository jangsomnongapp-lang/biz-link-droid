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
        <h1 className="flex-1 text-center text-base font-semibold">{t("terms")}</h1>
        <span className="w-9" />
      </header>

      <article className="mx-auto max-w-2xl space-y-5 px-4 py-5 text-sm leading-relaxed text-foreground">
        <p className="text-xs text-muted-foreground">{t("last_updated_april_2026")}</p>

        {lang === "km" ? <>
          <Section title="១. ការយល់ព្រមលើលក្ខខណ្ឌ">តាមរយៈការបង្កើតគណនី ឬប្រើប្រាស់ BuildHub អ្នកយល់ព្រមតាមលក្ខខណ្ឌទាំងនេះ។ បើមិនយល់ព្រម សូមកុំប្រើកម្មវិធី។</Section>
          <Section title="២. សិទ្ធិប្រើប្រាស់">អ្នកត្រូវមានអាយុយ៉ាងតិច ១៨ ឆ្នាំ និងអាចចុះកិច្ចសន្យាតាមច្បាប់។ អ្នកទទួលខុសត្រូវចំពោះភាពត្រឹមត្រូវនៃព័ត៌មានដែលបានផ្តល់។</Section>
          <Section title="៣. គណនី និងសុវត្ថិភាព">រក្សាពាក្យសម្ងាត់របស់អ្នកជាការសម្ងាត់។ អ្នកទទួលខុសត្រូវចំពោះសកម្មភាពក្នុងគណនី និងត្រូវជូនដំណឹងភ្លាមៗបើសង្ស័យថាមានការចូលប្រើដោយគ្មានសិទ្ធិ។</Section>
          <Section title="៤. មាតិការបស់អ្នកប្រើ">អ្នកនៅតែជាម្ចាស់មាតិកាដែលបានបង្ហោះ ប៉ុន្តែផ្តល់សិទ្ធិឱ្យ BuildHub បង្ហាញវានៅលើវេទិកា។ ហាមបង្ហោះមាតិកាខុសច្បាប់ បំពាន បោកបញ្ឆោត ឬរំលោភសិទ្ធិ។</Section>
          <Section title="៥. ការងារ គម្រោង និងការទូទាត់">BuildHub ភ្ជាប់អតិថិជន និងអ្នកជំនាញ។ កិច្ចព្រមព្រៀង ការទូទាត់ និងការងារគឺរវាងភាគីពាក់ព័ន្ធ។ BuildHub មិនទទួលខុសត្រូវចំពោះគុណភាព សុវត្ថិភាព ភាពស្របច្បាប់ ឬការទូទាត់ទេ។</Section>
          <Section title="៦. សកម្មភាពហាមឃាត់">ហាមផ្ញើសាររំខាន បៀតបៀន បោកប្រាស់ ទាញយកទិន្នន័យ ឬព្យាយាមរំលងសុវត្ថិភាព។ ការបំពានអាចនាំឱ្យលុបមាតិកា ឬផ្អាកគណនី។</Section>
          <Section title="៧. ការត្រួតពិនិត្យ">យើងអាចពិនិត្យ កែសម្រួល ឬលុបមាតិកាដែលរំលោភលក្ខខណ្ឌ ឬច្បាប់ និងផ្អាកគណនីតាមការចាំបាច់។</Section>
          <Section title="៨. ការបដិសេធការធានា">សេវាត្រូវបានផ្តល់ជូនតាមស្ថានភាពជាក់ស្តែង ដោយគ្មានការធានា។ យើងមិនធានាថាសេវានឹងដំណើរការដោយមិនដាច់ ឬគ្មានកំហុសទេ។</Section>
          <Section title="៩. ដែនកំណត់នៃការទទួលខុសត្រូវ">តាមកម្រិតអតិបរមាដែលច្បាប់អនុញ្ញាត BuildHub មិនទទួលខុសត្រូវចំពោះការខូចខាតដោយប្រយោល ឬបន្តបន្ទាប់ពីការប្រើវេទិកាទេ។</Section>
          <Section title="១០. ការផ្លាស់ប្តូរ">យើងអាចកែប្រែលក្ខខណ្ឌទាំងនេះ។ ការបន្តប្រើប្រាស់ក្រោយការកែប្រែមានន័យថាអ្នកយល់ព្រមនឹងលក្ខខណ្ឌថ្មី។</Section>
          <Section title="១១. ទំនាក់ទំនង">មានសំណួរអំពីលក្ខខណ្ឌ? សូមចូលទៅ ការកំណត់ → រាយការណ៍បញ្ហា។</Section>
        </> : <>
          <Section title="1. Acceptance of terms">By creating an account or using BuildHub, you agree to these Terms & Conditions. If you do not agree, please do not use the app.</Section>

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
        </>}
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
