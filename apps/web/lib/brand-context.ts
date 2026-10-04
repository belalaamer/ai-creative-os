import type { SupabaseClient } from '@supabase/supabase-js';

export type BrandContext = {
  brand: any | null;
  products: any[];
  audiences: any[];
  offers: any[];
  guidelines: any | null;
  assets: any[];
};

export async function loadBrandContext(supabase: SupabaseClient, brandId?: string | null): Promise<BrandContext> {
  if (!brandId) return { brand: null, products: [], audiences: [], offers: [], guidelines: null, assets: [] };
  const [brandRes, productsRes, audiencesRes, offersRes, guidelinesRes, assetsRes] = await Promise.all([
    supabase.from('brands').select('id,name,industry,description,tone_of_voice,visual_identity,defaults').eq('id', brandId).single(),
    supabase.from('brand_products').select('id,name,description,price,offer,attributes').eq('brand_id', brandId).order('created_at', { ascending: true }),
    supabase.from('brand_audiences').select('id,name,description,demographics,psychographics,pains,desires,objections').eq('brand_id', brandId).order('created_at', { ascending: true }),
    supabase.from('brand_offers').select('id,name,description,original_price,offer_price,currency,valid_from,valid_to,terms,active').eq('brand_id', brandId).eq('active', true).order('created_at', { ascending: false }),
    supabase.from('brand_guidelines').select('preferred_phrases,forbidden_phrases,forbidden_claims,legal_notes,cta_preferences,content_rules').eq('brand_id', brandId).maybeSingle(),
    supabase.from('brand_assets').select('id,asset_type,storage_path,metadata').eq('brand_id', brandId).order('created_at', { ascending: true }),
  ]);
  return {
    brand: brandRes.data ?? null,
    products: productsRes.data ?? [],
    audiences: audiencesRes.data ?? [],
    offers: offersRes.data ?? [],
    guidelines: guidelinesRes.data ?? null,
    assets: assetsRes.data ?? [],
  };
}

export function compactBrandContext(context: BrandContext) {
  return {
    brand: context.brand,
    products: context.products.slice(0, 20),
    audiences: context.audiences.slice(0, 10),
    offers: context.offers.slice(0, 10),
    guidelines: context.guidelines,
    assets: context.assets.slice(0, 20).map((x) => ({ asset_type: x.asset_type, metadata: x.metadata })),
  };
}
