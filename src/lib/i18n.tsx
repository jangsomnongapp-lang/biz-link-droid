import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "km" | "en";

type Dict = Record<string, { km: string; en: string }>;

const dict: Dict = {
  app_name: { km: "ជាងសំណង់", en: "Project 001" },
  tagline: { km: "រកការងារ · រកអ្នកជំនាញ", en: "Find work · Find workers" },
  register: { km: "ចុះឈ្មោះ", en: "Register" },
  have_account: { km: "មានគណនីរួចហើយ", en: "I already have an account" },
  // steps
  step_of: { km: "ជំហាន {n} នៃ ៣", en: "Step {n} of 3" },
  who_are_you: { km: "តើអ្នកជានរណា?", en: "Who are you?" },
  select_all_apply: { km: "ជ្រើសរើសទាំងអស់ដែលត្រូវការ", en: "Select all that apply" },
  role_provider: { km: "អ្នកធ្វើការ", en: "Worker" },
  role_provider_desc: { km: "ខ្ញុំផ្តល់សេវាសាងសង់", en: "I offer construction services" },
  role_coordinator: { km: "មេក្រុម", en: "Team leader" },
  role_coordinator_desc: { km: "ខ្ញុំគ្រប់គ្រងក្រុមកម្មករ", en: "I manage a crew of workers" },
  role_organization: { km: "ក្រុមហ៊ុន", en: "Company" },
  role_organization_desc: { km: "អាជីវកម្មសាងសង់", en: "Construction business" },
  role_client: { km: "អ្នកម៉ៅការ", en: "Client" },
  role_client_desc: { km: "ខ្ញុំត្រូវការកម្មករសម្រាប់ការងារ", en: "I need workers for a project" },
  next: { km: "បន្ទាប់ →", en: "Next →" },
  back: { km: "← ត្រឡប់", en: "← Back" },
  your_specialties: { km: "ជំនាញរបស់អ្នក", en: "Your specialties" },
  your_details: { km: "ព័ត៌មានរបស់អ្នក", en: "Your details" },
  almost_done: { km: "ជិតរួចរាល់ — ព័ត៌មានបន្ថែមតិចតួច", en: "Almost done — just a few details" },
  full_name: { km: "ឈ្មោះពេញ", en: "Full name" },
  full_name_ph: { km: "ឈ្មោះរបស់អ្នក...", en: "Your name..." },
  phone: { km: "លេខទូរសព្ទ", en: "Phone number" },
  phone_ph: { km: "លេខរបស់អ្នក...", en: "Your number..." },
  password: { km: "ពាក្យសម្ងាត់", en: "Password" },
  show: { km: "បង្ហាញ", en: "Show" },
  hide: { km: "លាក់", en: "Hide" },
  lets_go: { km: "ទៅ​!", en: "Let's go!" },
  or: { km: "ឬ", en: "or" },
  // login
  welcome_back: { km: "សូមស្វាគមន៍ត្រលប់មកវិញ", en: "Welcome back" },
  login: { km: "ចូល", en: "Log in" },
  forgot_password: { km: "ភ្លេចពាក្យសម្ងាត់?", en: "Forgot your password?" },
  no_account: { km: "មិនទាន់មានគណនី?", en: "Don't have an account?" },
  // nav
  nav_home: { km: "ដើម", en: "Home" },
  nav_listings: { km: "ការងារ", en: "Listings" },
  nav_announce: { km: "ប្រកាស", en: "Announce" },
  nav_alerts: { km: "ជូនដំណឹង", en: "Alerts" },
  nav_profile: { km: "ប្រវត្តិរូប", en: "Profile" },
  // home
  what_share: { km: "តើអ្នកចង់ចែករំលែកអ្វី?", en: "What do you want to share?" },
  create_story: { km: "បង្កើតរឿង", en: "Create story" },
  like: { km: "ចូលចិត្ត", en: "Like" },
  comment: { km: "មតិ", en: "Comment" },
  share: { km: "ចែករំលែក", en: "Share" },
  no_posts: { km: "មិនទាន់មានការបង្ហោះ", en: "No posts yet" },
  // listings
  post_listing: { km: "បង្ហោះការងារ", en: "Post a project" },
  new_listing: { km: "+ បង្ហោះការងារ", en: "+ Post a project" },
  listing_title: { km: "ចំណងជើង", en: "Project title" },
  listing_title_ph: { km: "ឧ. ត្រូវការជាងអគ្គិសនីសម្រាប់ហាង", en: "e.g. Need electrician for shop renovation" },
  description: { km: "ការពិពណ៌នា", en: "Description" },
  optional: { km: "ស្រេច​ចិត្ត", en: "optional" },
  required: { km: "ទាមទារ", en: "required" },
  desc_ph: { km: "ពិពណ៌នាការងារដែលត្រូវការ...", en: "Describe the work needed..." },
  specialty_needed: { km: "ជំនាញដែលត្រូវការ", en: "Specialty needed" },
  photos: { km: "រូបថត", en: "Photos" },
  add_photo: { km: "បន្ថែមរូបថត", en: "Add photo" },
  location: { km: "ទីតាំង", en: "Location" },
  location_ph: { km: "តំបន់ / ខណ្ឌ", en: "Area / district" },
  budget: { km: "ថវិកា", en: "Budget" },
  budget_ph: { km: "ចំនួន", en: "Amount" },
  to_discuss: { km: "$ ពិភាក្សា", en: "$ To discuss" },
  apply: { km: "ដាក់ពាក្យ", en: "Apply" },
  applied: { km: "បានដាក់ពាក្យ", en: "Applied" },
  contact: { km: "ទាក់ទង", en: "Contact" },
  apply_confirm_title: { km: "ដាក់ពាក្យសម្រាប់ការងារនេះ?", en: "Apply to this project?" },
  confirm: { km: "បញ្ជាក់", en: "Confirm" },
  cancel: { km: "បោះបង់", en: "Cancel" },
  about_client: { km: "អំពីអ្នកម៉ៅការ", en: "About the client" },
  projects_posted: { km: "ការងារបានបង្ហោះ", en: "Projects posted" },
  project_detail: { km: "ព័ត៌មានការងារ", en: "Project detail" },
  // profile
  my_profile: { km: "ប្រវត្តិរូបរបស់ខ្ញុំ", en: "My Profile" },
  edit: { km: "កែសម្រួល", en: "Edit" },
  edit_profile: { km: "កែសម្រួលប្រវត្តិរូប", en: "Edit profile" },
  applied_to: { km: "បានដាក់ពាក្យ", en: "Applied to" },
  contacts_made: { km: "ការទំនាក់ទំនង", en: "Contacts made" },
  about_me: { km: "អំពីខ្ញុំ", en: "About me" },
  about_me_ph: { km: "ប្រាប់អ្នកដទៃអំពីខ្លួនអ្នក...", en: "Tell others about yourself..." },
  portfolio: { km: "ផលប័ត្រ", en: "Portfolio" },
  my_projects: { km: "ការងាររបស់ខ្ញុំ", en: "My projects" },
  active: { km: "កំពុងដំណើរការ", en: "Active" },
  closed: { km: "បិទ", en: "Closed" },
  save_changes: { km: "រក្សាទុក", en: "Save changes" },
  logout: { km: "ចេញ", en: "Log out" },
  // misc
  loading: { km: "កំពុងផ្ទុក...", en: "Loading..." },
  error_generic: { km: "មានបញ្ហាកើតឡើង", en: "Something went wrong" },
  search_ph: { km: "ស្វែងរក...", en: "Search..." },
  min_ago: { km: "នាទីមុន", en: "min ago" },
  hour_ago: { km: "ម៉ោងមុន", en: "hour ago" },
  day_ago: { km: "ថ្ងៃមុន", en: "day ago" },
  just_now: { km: "ឥឡូវ​នេះ", en: "just now" },
  group_structure: { km: "រចនាសម្ព័ន្ធ", en: "STRUCTURE" },
  group_installations: { km: "ការដំឡើង", en: "INSTALLATIONS" },
  group_finishing: { km: "ការបញ្ចប់", en: "FINISHING" },
  group_other: { km: "ផ្សេងៗ", en: "OTHER" },
};

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: keyof typeof dict, vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === "undefined") return "km";
    return (localStorage.getItem("lang") as Lang) || "km";
  });
  useEffect(() => {
    localStorage.setItem("lang", lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const t: I18nCtx["t"] = (key, vars) => {
    const entry = dict[key];
    if (!entry) return String(key);
    let s = entry[lang];
    if (vars) for (const k of Object.keys(vars)) s = s.replaceAll(`{${k}}`, String(vars[k]));
    return s;
  };

  return <Ctx.Provider value={{ lang, setLang: setLangState, t }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useI18n must be used within I18nProvider");
  return c;
}
