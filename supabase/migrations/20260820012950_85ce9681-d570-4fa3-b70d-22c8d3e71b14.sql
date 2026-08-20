insert into public.supplier_catalog_items
  (store_id, category_id, name_en, name_km, unit, price, currency, in_stock, photo_url, note, source, stock_status, offer_active, offer_price)
select
  s.id,
  sc.id,
  coalesce(nullif(split_part(p.title, ' - ', 1), ''), p.title, 'Product'),
  p.title,
  'unit',
  coalesce(p.price, p.discount_price),
  coalesce(p.currency, 'USD'),
  true,
  (select ph.photo_url from public.post_photos ph where ph.post_id = p.id order by ph.created_at limit 1),
  left(coalesce(p.content, ''), 300),
  'post',
  case when p.post_type = 'stock' then 'in_stock' else 'in_stock' end,
  p.discount_price is not null,
  p.discount_price
from public.posts p
join public.supplier_stores s on s.user_id = p.user_id and s.status in ('approved','active')
left join public.supplier_categories sc on sc.code = p.category
where p.status = 'approved'
  and p.post_type <> 'general'
  and coalesce(p.title, '') <> ''
  and not exists (
    select 1 from public.supplier_catalog_items i
    where i.store_id = s.id and lower(i.name_en) = lower(coalesce(nullif(split_part(p.title, ' - ', 1), ''), p.title))
  );