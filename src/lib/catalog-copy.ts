export type Lang = "en" | "km";

const COPY = {
  catalog: { en: "Catalogue", km: "កាតាឡុក" },
  catalog_add_title: { en: "Add products to your catalogue", km: "បន្ថែមផលិតផលទៅកាតាឡុក" },
  catalog_add_sub: { en: "Choose how you want to add them", km: "ជ្រើសរើសវិធីបន្ថែម" },
  choose_method: { en: "CHOOSE A METHOD", km: "ជ្រើសរើសវិធី" },
  method_list: { en: "Select from list", km: "ជ្រើសពីបញ្ជី" },
  method_list_desc: {
    en: "Pick from the most common materials in Cambodia. Fast setup for new stores.",
    km: "ជ្រើសពីសម្ភារៈពេញនិយមក្នុងកម្ពុជា។ ងាយស្រួលសម្រាប់ហាងថ្មី។",
  },
  recommended_first: { en: "Recommended for first time", km: "ណែនាំសម្រាប់លើកដំបូង" },
  method_import: { en: "Import from file or photo", km: "នាំចូលពីឯកសារ ឬរូបថត" },
  method_import_desc: {
    en: "Upload your price list — Excel, photo, PDF or WhatsApp. AI converts it automatically.",
    km: "បញ្ចូលបញ្ជីតម្លៃ — Excel, រូបថត, PDF ឬ WhatsApp។ AI បំលែងស្វ័យប្រវត្តិ។",
  },
  method_photo: { en: "Photo of product", km: "រូបថតផលិតផល" },
  method_photo_desc: {
    en: "Take a photo and AI fills in the details. Best for adding individual items.",
    km: "ថតរូប ហើយ AI បំពេញព័ត៌មាន។ ល្អសម្រាប់បន្ថែមម្តងមួយ។",
  },
  methods_note: {
    en: "You can use all three methods at any time. Start with the list, then add new products by photo as they arrive.",
    km: "អ្នកអាចប្រើវិធីទាំងបីពេលណាក៏បាន។ ចាប់ផ្តើមពីបញ្ជី បន្ទាប់មកបន្ថែមតាមរូបថត។",
  },
  already_in_catalog: { en: "Already in your catalogue", km: "មានក្នុងកាតាឡុករួចហើយ" },
  continue: { en: "Continue", km: "បន្ត" },
  step_of: { en: "Step {n} of 3", km: "ជំហាន {n} ក្នុង ៣" },
  step1_title: { en: "Choose your categories", km: "ជ្រើសប្រភេទរបស់អ្នក" },
  step1_sub: {
    en: "Tap all the categories you carry. We'll show you the most common products for each one.",
    km: "ចុចលើប្រភេទទាំងអស់ដែលអ្នកមាន។ យើងបង្ហាញផលិតផលពេញនិយមនីមួយៗ។",
  },
  step2_title: { en: "Mark what you have", km: "ធីកអ្វីដែលអ្នកមាន" },
  step2_sub: {
    en: "Tap each product you sell and set your price. Price is optional.",
    km: "ចុចផលិតផលដែលអ្នកលក់ ហើយដាក់តម្លៃ។ តម្លៃមិនចាំបាច់។",
  },
  step3_title: { en: "Review and publish", km: "ពិនិត្យ និងបង្ហោះ" },
  step3_sub: { en: "Check your products before saving.", km: "ពិនិត្យផលិតផលមុនរក្សាទុក។" },
  products_count: { en: "products", km: "ផលិតផល" },
  selected_categories: { en: "categories selected", km: "ប្រភេទបានជ្រើស" },
  selected_products: { en: "products selected", km: "ផលិតផលបានជ្រើស" },
  save_catalog: { en: "Save to catalogue", km: "រក្សាទុកក្នុងកាតាឡុក" },
  saving: { en: "Saving…", km: "កំពុងរក្សាទុក…" },
  saved: { en: "Catalogue updated", km: "កាតាឡុកបានធ្វើបច្ចុប្បន្នភាព" },
  back: { en: "Back", km: "ត្រឡប់" },
  in_stock: { en: "In stock", km: "មានស្តុក" },
  out_of_stock: { en: "Out of stock", km: "អស់ស្តុក" },
  price: { en: "Price", km: "តម្លៃ" },
  unit: { en: "Unit", km: "ឯកតា" },
  upload_title: { en: "Import your price list", km: "នាំចូលបញ្ជីតម្លៃ" },
  upload_sub: {
    en: "Excel, CSV, PDF, a photo of handwritten paper or a WhatsApp screenshot — any format works.",
    km: "Excel, CSV, PDF, រូបថតក្រដាសសរសេរដៃ ឬ WhatsApp — គ្រប់ទម្រង់បាន។",
  },
  pick_file: { en: "Choose file or photo", km: "ជ្រើសឯកសារ ឬរូបថត" },
  reading_file: { en: "AI is reading your price list…", km: "AI កំពុងអានបញ្ជីតម្លៃ…" },
  import_found: { en: "products found", km: "ផលិតផលបានរកឃើញ" },
  import_failed: {
    en: "We couldn't read that file. Try a clearer photo or another format.",
    km: "យើងអានឯកសារនេះមិនបាន។ សាកល្បងរូបថតច្បាស់ជាង។",
  },
  import_empty: {
    en: "No products found in that file. Try a clearer photo.",
    km: "រកមិនឃើញផលិតផលក្នុងឯកសារនេះ។ សាកល្បងរូបថតច្បាស់ជាង។",
  },
  photo_title: { en: "Photograph a product", km: "ថតរូបផលិតផល" },
  photo_sub: {
    en: "AI identifies the name, category and description. You only confirm price and stock.",
    km: "AI កំណត់ឈ្មោះ ប្រភេទ និងការពិពណ៌នា។ អ្នកគ្រាន់តែបញ្ជាក់តម្លៃ និងស្តុក។",
  },
  take_photo: { en: "Take or choose a photo", km: "ថត ឬជ្រើសរូបថត" },
  identifying: { en: "AI is identifying the product…", km: "AI កំពុងកំណត់ផលិតផល…" },
  not_recognized: {
    en: "We couldn't identify that product. Try a closer photo.",
    km: "យើងកំណត់ផលិតផលនេះមិនបាន។ សាកល្បងថតជិតជាង។",
  },
  product_name: { en: "Product name", km: "ឈ្មោះផលិតផល" },
  category: { en: "Category", km: "ប្រភេទ" },
  description: { en: "Description", km: "ការពិពណ៌នា" },
  add_product: { en: "Add to catalogue", km: "បន្ថែមទៅកាតាឡុក" },
  my_catalog: { en: "My catalogue", km: "កាតាឡុករបស់ខ្ញុំ" },
  catalog_items: { en: "products in catalogue", km: "ផលិតផលក្នុងកាតាឡុក" },
  empty_catalog: { en: "No products yet", km: "មិនមានផលិតផលទេ" },
  remove: { en: "Remove", km: "លុប" },
  select_at_least_one: { en: "Select at least one item", km: "ជ្រើសយ៉ាងហោចមួយ" },
  no_products_for_category: {
    en: "No suggested products for this category yet — add them by photo or import.",
    km: "មិនមានផលិតផលស្នើសម្រាប់ប្រភេទនេះទេ — បន្ថែមតាមរូបថត ឬនាំចូល។",
  },
  step3_header: { en: "Set prices & stock", km: "កំណត់តម្លៃ និងស្តុក" },
  almost_done: { en: "Almost done", km: "ជិតរួចរាល់" },
  step3_section: { en: "STEP 3 — PRICES & AVAILABILITY", km: "ជំហាន ៣ — តម្លៃ និងស្តុក" },
  set_your_prices: { en: "Set your prices", km: "កំណត់តម្លៃរបស់អ្នក" },
  set_your_prices_sub: {
    en: "Add a photo, set your price and stock. Photo is optional — AI fills details automatically.",
    km: "បន្ថែមរូបថត កំណត់តម្លៃ និងស្តុក។ រូបថតមិនចាំបាច់ — AI បំពេញព័ត៌មានស្វ័យប្រវត្តិ។",
  },
  your_price: { en: "Your price", km: "តម្លៃរបស់អ្នក" },
  availability: { en: "Availability", km: "ស្តុក" },
  low_stock: { en: "Low", km: "តិច" },
  out_label: { en: "Out", km: "អស់" },
  market_range: { en: "Market range", km: "ចន្លោះតម្លៃទីផ្សារ" },
  product_photo: { en: "Product photo", km: "រូបថតផលិតផល" },
  photo_hint: {
    en: "Upload a photo — AI will fill name and description.",
    km: "បញ្ចូលរូបថត — AI នឹងបំពេញឈ្មោះ និងការពិពណ៌នា។",
  },
  photo_hint_done: {
    en: "AI auto-fills name and description from your photo.",
    km: "AI បំពេញឈ្មោះ និងការពិពណ៌នាពីរូបថតរបស់អ្នក។",
  },
  photo_added: { en: "Photo added", km: "បានបន្ថែមរូបថត" },
  add_photo: { en: "Add photo", km: "បន្ថែមរូបថត" },
  added: { en: "Added", km: "បានបន្ថែម" },
  autofilled_tap_edit: { en: "Auto-filled · tap to edit", km: "បំពេញស្វ័យប្រវត្តិ · ចុចដើម្បីកែ" },
  optional: { en: "Optional", km: "មិនចាំបាច់" },
  catalog_ready: { en: "Catalogue ready", km: "កាតាឡុករួចរាល់" },
  publish_catalog: { en: "Publish catalogue", km: "បង្ហោះកាតាឡុក" },
  category_one: { en: "category", km: "ប្រភេទ" },
} as const;


export type CopyKey = keyof typeof COPY;

export function catalogCopy(lang: string, key: CopyKey): string {
  const entry = COPY[key];
  return lang === "km" ? entry.km : entry.en;
}
