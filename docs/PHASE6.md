# Phase 6 — Brand Context Engine + A/B/C Campaign Variants

## Delivered
- Brand Context Engine loads brand profile, products, audiences, active offers, guidelines and asset metadata.
- Each project stores an immutable brand-context snapshot for reproducibility/auditability.
- Creative Brief and Storyboard provider prompts now receive structured brand context and respect forbidden claims/legal notes.
- Campaign Variants engine creates exactly three materially different variants (A/B/C).
- Each variant stores angle, hook, primary text, headline, CTA, script, target audience and rationale.
- User can select one variant before generating the storyboard, so downstream image/video production follows the chosen angle.
- Project detail page shows saved A/B/C variants.
- Separate credit price for campaign-variant generation.

## Data model
- `brand_context_snapshots`
- `campaign_variants`

## Production principle
A project uses a frozen brand snapshot so later brand edits do not silently change the historical reasoning behind already-generated campaign assets.
