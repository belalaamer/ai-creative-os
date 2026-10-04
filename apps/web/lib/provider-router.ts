export type QualityTier = 'fast' | 'quality' | 'ultra';
export type ProviderKind = 'text' | 'image' | 'audio' | 'video';

export type ProviderConfig = {
  kind: ProviderKind;
  quality: QualityTier;
  endpoint: string;
  apiKey: string;
  model: string;
  provider: string;
  statusEndpoint?: string;
  voice?: string;
  inputCostPerMillionUsd?: number;
  outputCostPerMillionUsd?: number;
  unitCostUsd?: number;
  timeoutMs?: number;
  routeKey: string;
  adapter?: string;
};

const legacyPrefix: Record<ProviderKind, string> = {
  text: 'TEXT_AI', image: 'IMAGE_AI', audio: 'VOICE_AI', video: 'VIDEO_AI'
};

function n(value?: string) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function normalizeQuality(value: unknown): QualityTier {
  return value === 'fast' || value === 'ultra' ? value : 'quality';
}

export function configFromPrefix(kind: ProviderKind, quality: QualityTier, prefix: string, routeKey: string): ProviderConfig | null {
  const endpoint = process.env[`${prefix}_ENDPOINT`];
  const apiKey = process.env[`${prefix}_API_KEY`];
  const model = process.env[`${prefix}_MODEL`];
  if (!endpoint || !apiKey || !model) return null;
  return {
    kind,
    quality,
    endpoint,
    apiKey,
    model,
    provider: process.env[`${prefix}_PROVIDER`] || `external-${kind}`,
    statusEndpoint: kind === 'video' ? process.env[`${prefix}_STATUS_ENDPOINT`] : undefined,
    voice: kind === 'audio' ? (process.env[`${prefix}_VOICE`] || 'default') : undefined,
    inputCostPerMillionUsd: n(process.env[`${prefix}_INPUT_COST_PER_MILLION_USD`]),
    outputCostPerMillionUsd: n(process.env[`${prefix}_OUTPUT_COST_PER_MILLION_USD`]),
    unitCostUsd: n(process.env[`${prefix}_UNIT_COST_USD`]),
    timeoutMs: n(process.env[`${prefix}_TIMEOUT_MS`]),
    routeKey,
    adapter: process.env[`${prefix}_ADAPTER`],
  };
}

/**
 * Provider order:
 * 1. TIER_PRIMARY_* (preferred production naming)
 * 2. TIER_* (Phase 5 compatible)
 * 3. TIER_FALLBACK_1_* / _2_* / _3_*
 * 4. Legacy KIND_AI_* variables
 */
export function getProviderCandidates(kind: ProviderKind, qualityInput: unknown): ProviderConfig[] {
  const quality = normalizeQuality(qualityInput);
  const tier = `${kind.toUpperCase()}_${quality.toUpperCase()}`;
  const candidates: ProviderConfig[] = [];
  const seen = new Set<string>();

  const add = (config: ProviderConfig | null) => {
    if (!config) return;
    const key = `${config.provider}|${config.model}|${config.endpoint}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(config);
  };

  add(configFromPrefix(kind, quality, `${tier}_PRIMARY`, 'primary'));
  add(configFromPrefix(kind, quality, tier, 'tier'));
  for (let i = 1; i <= 3; i++) add(configFromPrefix(kind, quality, `${tier}_FALLBACK_${i}`, `fallback_${i}`));

  const legacy = legacyPrefix[kind];
  const legacyEndpoint = process.env[`${legacy}_ENDPOINT`];
  const legacyApiKey = process.env[`${legacy}_API_KEY`];
  const legacyModel = process.env[`${legacy}_MODEL`];
  if (legacyEndpoint && legacyApiKey && legacyModel) {
    add({
      kind,
      quality,
      endpoint: legacyEndpoint,
      apiKey: legacyApiKey,
      model: legacyModel,
      provider: process.env[`${legacy}_PROVIDER`] || `external-${kind}`,
      statusEndpoint: kind === 'video' ? process.env.VIDEO_AI_STATUS_ENDPOINT : undefined,
      voice: kind === 'audio' ? (process.env.VOICE_AI_VOICE || 'default') : undefined,
      inputCostPerMillionUsd: n(process.env[`${legacy}_INPUT_COST_PER_MILLION_USD`]),
      outputCostPerMillionUsd: n(process.env[`${legacy}_OUTPUT_COST_PER_MILLION_USD`]),
      unitCostUsd: n(process.env[`${legacy}_UNIT_COST_USD`]),
      timeoutMs: n(process.env[`${legacy}_TIMEOUT_MS`]),
      routeKey: 'legacy',
      adapter: process.env[`${legacy}_ADAPTER`],
    });
  }
  return candidates;
}


export async function resolveProviderCandidates(supabase: any, organizationId: string, kind: ProviderKind, qualityInput: unknown): Promise<ProviderConfig[]> {
  const quality = normalizeQuality(qualityInput);
  const resolved: ProviderConfig[] = [];
  const seen = new Set<string>();
  const add = (config: ProviderConfig | null) => {
    if (!config) return;
    const key = `${config.provider}|${config.model}|${config.endpoint}`;
    if (seen.has(key)) return;
    seen.add(key); resolved.push(config);
  };
  try {
    const { data } = await supabase
      .from('organization_provider_settings')
      .select('provider_code,model_code,env_prefix,priority,enabled')
      .eq('organization_id', organizationId)
      .eq('kind', kind)
      .eq('quality_tier', quality)
      .eq('enabled', true)
      .order('priority', { ascending: true });
    for (const row of data ?? []) {
      const prefix=String(row.env_prefix);
      const endpoint=process.env[`${prefix}_ENDPOINT`];
      const apiKey=process.env[`${prefix}_API_KEY`];
      if(!endpoint||!apiKey) continue;
      add({
        kind, quality, endpoint, apiKey,
        model:String(row.model_code), provider:String(row.provider_code),
        statusEndpoint:kind==='video'?process.env[`${prefix}_STATUS_ENDPOINT`]:undefined,
        voice:kind==='audio'?(process.env[`${prefix}_VOICE`]||'default'):undefined,
        inputCostPerMillionUsd:n(process.env[`${prefix}_INPUT_COST_PER_MILLION_USD`]),
        outputCostPerMillionUsd:n(process.env[`${prefix}_OUTPUT_COST_PER_MILLION_USD`]),
        unitCostUsd:n(process.env[`${prefix}_UNIT_COST_USD`]),
        timeoutMs:n(process.env[`${prefix}_TIMEOUT_MS`]),
        routeKey:`org:${row.priority}`,
        adapter:process.env[`${prefix}_ADAPTER`],
      });
    }
  } catch {}
  for (const cfg of getProviderCandidates(kind, quality)) add(cfg);
  return resolved;
}

export function getProviderConfig(kind: ProviderKind, qualityInput: unknown): ProviderConfig | null {
  return getProviderCandidates(kind, qualityInput)[0] ?? null;
}

export function estimateTextCostUsd(config: ProviderConfig, usage: any): number | undefined {
  const input = Number(usage?.prompt_tokens ?? usage?.input_tokens ?? 0);
  const output = Number(usage?.completion_tokens ?? usage?.output_tokens ?? 0);
  if (!config.inputCostPerMillionUsd && !config.outputCostPerMillionUsd) return undefined;
  return (input / 1_000_000) * (config.inputCostPerMillionUsd ?? 0)
    + (output / 1_000_000) * (config.outputCostPerMillionUsd ?? 0);
}

export function estimateUnitCostUsd(config: ProviderConfig, units = 1): number | undefined {
  return config.unitCostUsd == null ? undefined : config.unitCostUsd * units;
}

export function findProviderCandidate(kind: ProviderKind, qualityInput: unknown, providerCode?: string | null, modelCode?: string | null): ProviderConfig | null {
  const candidates=getProviderCandidates(kind,qualityInput);
  return candidates.find((c)=>c.provider===providerCode && (!modelCode || c.model===modelCode)) ?? candidates.find((c)=>c.provider===providerCode) ?? candidates[0] ?? null;
}
