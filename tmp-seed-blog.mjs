import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(url, key, { auth: { persistSession: false } });

const slug = 'test-ul-styling-' + Date.now();
const { data, error } = await supabase
  .from('blog_posts')
  .insert({
    slug,
    title: 'Test UL Styling',
    content: `## Sample list\n\nHere is a clean unordered list:\n\n- First item with some text to see line height and wrapping behavior\n- Second item\n  - Nested sub-item A\n  - Nested sub-item B\n- Third item with a longer description so we can verify spacing and alignment\n\nAnd a paragraph after the list.`,
    status: 'published',
    published_at: new Date().toISOString(),
  })
  .select('slug')
  .single();

if (error) {
  console.error('insert error:', error);
  process.exit(1);
}
console.log('created slug:', data.slug);
