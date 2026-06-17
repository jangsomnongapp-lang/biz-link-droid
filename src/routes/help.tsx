import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help & FAQ — BuildHub" },
      { name: "description", content: "Frequently asked questions and help for using BuildHub." },
    ],
  }),
  component: HelpPage,
});

interface QA {
  q: { km: string; en: string };
  a: { km: string; en: string };
}

const FAQS: QA[] = [
  {
    q: { en: "How do I create an account?", km: "តើខ្ញុំបង្កើតគណនីយ៉ាងដូចម្តេច?" },
    a: {
      en: "Tap Register on the welcome screen, choose your role (Worker, Team leader, Company, or Owner), then enter your name, phone, and password.",
      km: "ចុចចុះឈ្មោះនៅអេក្រង់ស្វាគមន៍ ជ្រើសរើសតួនាទីរបស់អ្នក រួចបញ្ចូលឈ្មោះ លេខទូរសព្ទ និងពាក្យសម្ងាត់។",
    },
  },
  {
    q: { en: "How do I post a project or job?", km: "តើខ្ញុំប្រកាសការងារយ៉ាងដូចម្តេច?" },
    a: {
      en: "Tap the + icon in the top bar, or open the Project tab and tap New. Add a title, description, photos, and budget.",
      km: "ចុចលើសញ្ញា + នៅរបារខាងលើ ឬបើកផ្ទាំងការងារ ហើយចុចថ្មី។ បន្ថែមគោលបំណង ប​រិយាយ​ រូបភាព និងថវិកា។",
    },
  },
  {
    q: { en: "How do I apply for a job?", km: "តើខ្ញុំដាក់ពាក្យការងារយ៉ាងដូចម្តេច?" },
    a: {
      en: "Open a project, then tap Apply. The owner will be notified and can message you back.",
      km: "បើកគម្រោងមួយ ហើយចុចដាក់ពាក្យ។ ម្ចាស់នឹងទទួលបានការដំណឹង ហើយអាចផ្ញើសារមកអ្នក។",
    },
  },
  {
    q: { en: "How do messages work?", km: "តើសារដំណើរការយ៉ាងណា?" },
    a: {
      en: "Tap the chat icon in the top bar to see your conversations. Open any thread to chat. Tap a person's name or avatar to view their profile.",
      km: "ចុចរូបសារនៅរបារខាងលើ ដើម្បីមើលការសន្ទនារបស់អ្នក។",
    },
  },
  {
    q: { en: "How do I report a post, project, or user?", km: "តើខ្ញុំរាយការណ៍យ៉ាងណា?" },
    a: {
      en: "Tap the three-dot menu on any post, project, or profile and choose Report. Add an optional reason. Admins will review it.",
      km: "ចុចលើម៉ឺនុយបីចំនុច នៅលើការប្រកាស គម្រោង ឬប្រវត្តិរូប រួចជ្រើសរើសរាយការណ៍។",
    },
  },
  {
    q: { en: "How do I change the language?", km: "តើខ្ញុំប្ដូរភាសាយ៉ាងណា?" },
    a: {
      en: "Open Settings → Preferences → Language. You can switch between Khmer and English anytime.",
      km: "បើកការកំណត់ → ចំណូលចិត្ត → ភាសា។",
    },
  },
  {
    q: { en: "How do I edit my profile?", km: "តើខ្ញុំកែប្រវត្តិរូបយ៉ាងណា?" },
    a: {
      en: "Open Settings → My account → Edit profile. You can also update your portfolio from the same section.",
      km: "បើកការកំណត់ → គណនីរបស់ខ្ញុំ → កែប្រវត្តិរូប។",
    },
  },
  {
    q: { en: "How do I delete my account?", km: "តើខ្ញុំលុបគណនីយ៉ាងណា?" },
    a: {
      en: "At the bottom of the Settings page, tap Delete account. This action cannot be undone.",
      km: "នៅផ្នែកខាងក្រោមនៃការកំណត់ ចុចលុបគណនី។ សកម្មភាពនេះមិនអាចត្រឡប់បានទេ។",
    },
  },
];

function HelpPage() {
  const { t, lang } = useI18n();
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
        <h1 className="flex-1 text-center text-base font-semibold">{t("help_faq")}</h1>
        <span className="w-9" />
      </header>

      <div className="mx-auto max-w-2xl px-4 py-5">
        <h2 className="mb-2 text-base font-bold text-foreground">
          {lang === "km" ? "សំណួរញឹកញាប់" : "Frequently asked questions"}
        </h2>
        <div className="rounded-xl bg-surface px-4 shadow-card">
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((item, i) => (
              <AccordionItem key={i} value={`q-${i}`}>
                <AccordionTrigger className="text-sm font-semibold">
                  {item.q[lang]}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  {item.a[lang]}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        <div className="mt-5 rounded-xl bg-surface p-4 shadow-card">
          <div className="mb-2 text-sm font-bold text-foreground">
            {lang === "km" ? "នៅតែត្រូវការជំនួយ?" : "Still need help?"}
          </div>
          <Link
            to="/report"
            className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2.5 text-sm font-semibold text-primary active:opacity-80"
          >
            <span>{t("report_problem")}</span>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
