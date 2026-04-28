import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "km" | "en";

type Dict = Record<string, { km: string; en: string }>;

const dict: Dict = {
  app_name: { km: "ជាងសំណង់", en: "BuildHub" },
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
  nav_listings: { km: "ការងារ", en: "Project" },
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
  // user profile (other)
  active_projects: { km: "ការងារកំពុងដំណើរការ", en: "Active projects" },
  // portfolio manager
  update_profile: { km: "បន្ទាន់សម័យប្រវត្តិរូប", en: "Update profile" },
  add_photos: { km: "+ បន្ថែមរូបថត", en: "+ Add photos" },
  add: { km: "បន្ថែម", en: "Add" },
  new_project: { km: "+ ការងារថ្មី", en: "+ New project" },
  close: { km: "បិទ", en: "Close" },
  reopen: { km: "បើកឡើងវិញ", en: "Reopen" },
  applicants: { km: "បេក្ខជន", en: "applicants" },
  applicants_title: { km: "បេក្ខជន", en: "Applicants" },
  no_applicants: { km: "មិនទាន់មានបេក្ខជន", en: "No applicants yet" },
  message: { km: "ផ្ញើសារ", en: "Message" },
  // messages
  messages: { km: "សារ", en: "Messages" },
  search_messages: { km: "ស្វែងរកសារ...", en: "Search messages..." },
  no_more_messages: { km: "គ្មានសារទៀត", en: "No more messages" },
  no_messages_yet: { km: "មិនទាន់មានសារ", en: "No messages yet" },
  online: { km: "កំពុងភ្ជាប់", en: "Online" },
  write_message: { km: "សរសេរសារ...", en: "Write a message..." },
  today: { km: "ថ្ងៃនេះ", en: "Today" },
  yesterday: { km: "ម្សិលមិញ", en: "Yesterday" },
  send: { km: "ផ្ញើ", en: "Send" },
  // notifications
  notifications: { km: "ការជូនដំណឹង", en: "Notifications" },
  mark_all_read: { km: "សម្គាល់ថាបានអាន", en: "Mark all read" },
  new_section: { km: "ថ្មី", en: "New" },
  earlier: { km: "មុននេះ", en: "Earlier" },
  no_notifications: { km: "មិនទាន់មានការជូនដំណឹង", en: "No notifications yet" },
  // new post
  new_post: { km: "ការបង្ហោះថ្មី", en: "New post" },
  share_what: { km: "តើអ្នកចង់ចែករំលែកអ្វី?", en: "What do you want to share?" },
  write_optional: { km: "សរសេរអ្វីមួយ... (ស្រេច​ចិត្ត)", en: "Write something... (optional)" },
  add_video_link: { km: "បន្ថែមតំណវីដេអូ", en: "Add a video link" },
  video_link_ph: { km: "បិទភ្ជាប់តំណវីដេអូនៅទីនេះ...", en: "Paste video link here..." },
  review_notice: {
    km: "ការបង្ហោះរបស់អ្នកនឹងត្រូវពិនិត្យមុនចេញផ្សាយ។ ជាធម្មតាវាចំណាយពេលពីរបីម៉ោង។",
    en: "Your post will be reviewed before publishing. This usually takes a few hours.",
  },
  submit_review: { km: "ដាក់ស្នើពិនិត្យ", en: "Submit for review" },
  posted: { km: "បានបង្ហោះ", en: "Posted" },
  // settings
  menu: { km: "ម៉ឺនុយ", en: "Menu" },
  my_account: { km: "គណនីរបស់ខ្ញុំ", en: "MY ACCOUNT" },
  preferences: { km: "ចំណូលចិត្ត", en: "PREFERENCES" },
  support: { km: "ជំនួយ", en: "SUPPORT" },
  change_password: { km: "ប្តូរពាក្យសម្ងាត់", en: "Change password" },
  change_phone: { km: "ប្តូរលេខទូរសព្ទ", en: "Change phone number" },
  language: { km: "ភាសា", en: "Language" },
  help_faq: { km: "ជំនួយ & សំណួរ", en: "Help & FAQ" },
  report_problem: { km: "រាយការណ៍បញ្ហា", en: "Report a problem" },
  terms: { km: "លក្ខខណ្ឌ", en: "Terms & conditions" },
  privacy: { km: "គោលការណ៍ឯកជន", en: "Privacy policy" },
  delete_account: { km: "លុបគណនី", en: "Delete account" },
  admin_panel: { km: "ផ្ទាំងគ្រប់គ្រង", en: "Admin panel" },
  // admin
  admin: { km: "អ្នកគ្រប់គ្រង", en: "Admin" },
  review_posts: { km: "ពិនិត្យការបង្ហោះ", en: "Review posts" },
  pending: { km: "កំពុងរង់ចាំ", en: "Pending" },
  pending_count: { km: "{n} រង់ចាំ", en: "{n} pending" },
  approve: { km: "អនុម័ត", en: "Approve" },
  reject: { km: "បដិសេធ", en: "Reject" },
  submitted_ago: { km: "បានដាក់ស្នើ", en: "Submitted" },
  no_pending: { km: "គ្មានការបង្ហោះរង់ចាំ", en: "No pending posts" },
  admin_confirm: { km: "ការបញ្ជាក់របស់អ្នកគ្រប់គ្រង", en: "Admin confirmation" },
  admin_confirm_desc: {
    km: "បញ្ចូលលេខកូដគ្រប់គ្រងដើម្បីលុបមាតិកានេះ។ សកម្មភាពនេះមិនអាចត្រឡប់វិញបានទេ។",
    en: "Enter your admin key to delete this content. This action cannot be undone.",
  },
  delete_content: { km: "លុបមាតិកា", en: "Delete content" },
  delete_failed: { km: "លុបមិនបានជោគជ័យ", en: "Delete failed" },
  approved: { km: "អនុម័តហើយ", en: "Approved" },
  rejected: { km: "បដិសេធ", en: "Rejected" },
  // stories
  story_new: { km: "រឿងថ្មី", en: "New story" },
  story_caption_ph: { km: "បន្ថែមអក្សរលើរូប... (ស្រេច​ចិត្ត)", en: "Add a caption... (optional)" },
  story_pick_photo: { km: "ជ្រើសរូបភាព", en: "Choose a photo" },
  story_review_notice: {
    km: "រឿងនឹងត្រូវពិនិត្យមុនចេញផ្សាយ ហើយបាត់ក្រោយ ២៤ ម៉ោង។",
    en: "Stories are reviewed before publishing and disappear after 24 hours.",
  },
  story_submit: { km: "ដាក់ស្នើរឿង", en: "Submit story" },
  story_posted: { km: "បានដាក់ស្នើរឿង", en: "Story submitted" },
  story_expires_in: { km: "នៅសល់ {h}ម៉ោង", en: "{h}h left" },
  no_stories: { km: "មិនទាន់មានរឿង", en: "No stories yet" },
  review_stories: { km: "ពិនិត្យរឿង", en: "Review stories" },
  tab_posts: { km: "ការបង្ហោះ", en: "Posts" },
  tab_stories: { km: "រឿង", en: "Stories" },
  // social
  liked: { km: "បានចូលចិត្ត", en: "Liked" },
  comments: { km: "មតិយោបល់", en: "Comments" },
  no_comments: { km: "មិនទាន់មានមតិ", en: "No comments yet" },
  write_comment: { km: "សរសេរមតិ...", en: "Write a comment..." },
  post_comment: { km: "ផ្ញើ", en: "Post" },
  share_link_copied: { km: "បានចម្លងតំណ", en: "Link copied" },
  viewers: { km: "អ្នកមើល", en: "Viewers" },
  no_viewers: { km: "មិនទាន់មានអ្នកមើល", en: "No viewers yet" },
  viewers_count: { km: "{n} អ្នកមើល", en: "{n} viewers" },
  reply: { km: "ឆ្លើយតប", en: "Reply" },
  replying_to: { km: "កំពុងឆ្លើយតបទៅ", en: "Replying to" },
  write_reply: { km: "សរសេរការឆ្លើយតប...", en: "Write a reply..." },
  // finish project
  mark_finished: { km: "សម្គាល់ថាបានបញ្ចប់", en: "Mark as finished" },
  finished: { km: "បានបញ្ចប់", en: "Finished" },
  finish_confirm_title: { km: "បញ្ចប់ការងារនេះ?", en: "Finish this project?" },
  finish_confirm_desc: {
    km: "ការងារនេះនឹងត្រូវបានសម្គាល់ថាបញ្ចប់ ហើយនឹងមិនអាចទទួលពាក្យបន្ថែមទៀតទេ។",
    en: "This project will be marked as finished and won't accept more applications.",
  },
  project_finished: { km: "ការងារបានបញ្ចប់", en: "Project finished" },
  accept: { km: "ទទួលយក", en: "Accept" },
  accepted: { km: "បានទទួល", en: "Accepted" },
  applicant_accepted: { km: "បានទទួលយកបេក្ខជន", en: "Applicant accepted" },
  currently_working: { km: "កំពុងធ្វើការ", en: "Currently working on this" },
  is_doing_it: { km: "កំពុងធ្វើការងារនេះ", en: "Is doing this project" },
  completed_by: { km: "បានបញ្ចប់ដោយ", en: "Completed by" },
  // listings review
  tab_listings: { km: "ការងារ", en: "Projects" },
  review_listings: { km: "ពិនិត្យការងារ", en: "Review projects" },
  listing_review_notice: {
    km: "ការងាររបស់អ្នកនឹងត្រូវពិនិត្យមុនចេញផ្សាយ។ ជាធម្មតាវាចំណាយពេលពីរបីម៉ោង។",
    en: "Your project will be reviewed before it goes live. This usually takes a few hours.",
  },
  delete: { km: "លុប", en: "Delete" },
  delete_confirm_desc: {
    km: "តើអ្នកប្រាកដទេថាចង់លុបការងារនេះ? សកម្មភាពនេះមិនអាចត្រឡប់វិញបានទេ។",
    en: "Are you sure you want to delete this project? This action cannot be undone.",
  },
  deleted: { km: "បានលុប", en: "Deleted" },
  more: { km: "ច្រើនទៀត", en: "More" },
  report: { km: "រាយការណ៍", en: "Report" },
  report_desc: {
    km: "ប្រាប់យើងពីមូលហេតុដែលអ្នករាយការណ៍។ អ្នកគ្រប់គ្រងនឹងពិនិត្យ។",
    en: "Tell us why you're reporting this. An admin will review it.",
  },
  report_reason_ph: { km: "មូលហេតុ (ស្រេចចិត្ត)...", en: "Reason (optional)..." },
  send_report: { km: "ផ្ញើរាយការណ៍", en: "Send report" },
  report_sent: { km: "បានផ្ញើរាយការណ៍", en: "Report sent" },
  reports: { km: "របាយការណ៍", en: "Reports" },
  review_reports: { km: "ពិនិត្យរបាយការណ៍", en: "Review reports" },
  no_reports: { km: "គ្មានរបាយការណ៍", en: "No reports" },
  resolve: { km: "ដោះស្រាយ", en: "Resolve" },
  dismiss: { km: "បោះបង់", en: "Dismiss" },
  open_status: { km: "បើក", en: "Open" },
  resolved: { km: "បានដោះស្រាយ", en: "Resolved" },
  dismissed: { km: "បានបោះបង់", en: "Dismissed" },
  reported_post: { km: "ការបង្ហោះ", en: "Post" },
  reported_listing: { km: "ការងារ", en: "Project" },
  reported_profile: { km: "គណនី", en: "Profile" },
  view: { km: "មើល", en: "View" },
  report_problem_title: { km: "រាយការណ៍បញ្ហា", en: "Report a problem" },
  report_problem_desc: {
    km: "ពិពណ៌នាពីបញ្ហាដែលអ្នកជួបប្រទះ។ ក្រុមការងាររបស់យើងនឹងពិនិត្យ។",
    en: "Describe the problem you're experiencing. Our team will review it.",
  },
  report_category: { km: "ប្រភេទបញ្ហា", en: "Problem type" },
  report_cat_bug: { km: "កំហុសកម្មវិធី", en: "App bug" },
  report_cat_account: { km: "បញ្ហាគណនី", en: "Account issue" },
  report_cat_payment: { km: "ការទូទាត់", en: "Payment" },
  report_cat_abuse: { km: "ការរំលោភបំពាន", en: "Abuse / safety" },
  report_cat_other: { km: "ផ្សេងៗ", en: "Other" },
  report_details: { km: "ព័ត៌មានលម្អិត", en: "Details" },
  report_details_ph: { km: "ពន្យល់បន្ថែម...", en: "Tell us more..." },
  submit: { km: "ផ្ញើ", en: "Submit" },
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
    return (localStorage.getItem("lang") as Lang) || "en";
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
