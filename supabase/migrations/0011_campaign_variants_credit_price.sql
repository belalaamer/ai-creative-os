insert into public.credit_prices(action_key,credits,display_name_ar,display_name_en,metadata)
values ('campaign_variants',3,'توليد 3 نسخ A/B/C','Generate A/B/C campaign variants','{"kind":"text"}')
on conflict (action_key) do update
set credits=excluded.credits, display_name_ar=excluded.display_name_ar, display_name_en=excluded.display_name_en, metadata=excluded.metadata, active=true, updated_at=now();
