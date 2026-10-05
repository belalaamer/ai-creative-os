import { createAdminClient } from '@/lib/server-admin';

const DEFAULT_SCOPES = [
  'ads_read',
  'ads_management',
  'business_management',
  'pages_show_list',
  'pages_read_engagement',
  'instagram_basic',
];

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function b64url(input: Uint8Array | string) {
  const bytes = typeof input === 'string' ? Buffer.from(input, 'utf8') : Buffer.from(input);
  return bytes.toString('base64url');
}

function fromB64url(input: string) {
  return new Uint8Array(Buffer.from(input, 'base64url'));
}

async function encryptionKey() {
  const raw = new TextEncoder().encode(required('META_TOKEN_ENCRYPTION_KEY'));
  const digest = await crypto.subtle.digest('SHA-256', raw);
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export function metaConfigured() {
  return Boolean(
    process.env.META_APP_ID &&
    process.env.META_APP_SECRET &&
    process.env.META_GRAPH_VERSION &&
    process.env.META_TOKEN_ENCRYPTION_KEY &&
    process.env.META_OAUTH_STATE_SECRET &&
    process.env.APP_URL
  );
}

export async function encryptMetaToken(token: string) {
  const key = await encryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(token));
  return `v1.${b64url(iv)}.${b64url(new Uint8Array(encrypted))}`;
}

export async function decryptMetaToken(value: string) {
  const [version, ivRaw, encryptedRaw] = value.split('.');
  if (version !== 'v1' || !ivRaw || !encryptedRaw) throw new Error('Invalid Meta credential');
  const key = await encryptionKey();
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64url(ivRaw) },
    key,
    fromB64url(encryptedRaw),
  );
  return new TextDecoder().decode(decrypted);
}

async function stateKey() {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(required('META_OAUTH_STATE_SECRET')),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function signMetaState(payload: { organizationId: string; userId: string; exp: number }) {
  const body = b64url(JSON.stringify(payload));
  const key = await stateKey();
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return `${body}.${b64url(new Uint8Array(sig))}`;
}

export async function verifyMetaState(state: string) {
  const [body, signature] = state.split('.');
  if (!body || !signature) throw new Error('Invalid OAuth state');
  const key = await stateKey();
  const ok = await crypto.subtle.verify('HMAC', key, fromB64url(signature), new TextEncoder().encode(body));
  if (!ok) throw new Error('Invalid OAuth state');
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { organizationId: string; userId: string; exp: number };
  if (!payload.exp || payload.exp < Date.now()) throw new Error('Expired OAuth state');
  return payload;
}

function graphBase() {
  return `https://graph.facebook.com/${required('META_GRAPH_VERSION')}`;
}

export function metaRedirectUri() {
  return `${required('APP_URL').replace(/\/$/, '')}/api/meta/callback`;
}

export function metaOauthUrl(state: string) {
  const scopes = (process.env.META_OAUTH_SCOPES || DEFAULT_SCOPES.join(',')).split(',').map(x => x.trim()).filter(Boolean);
  const params = new URLSearchParams({
    client_id: required('META_APP_ID'),
    redirect_uri: metaRedirectUri(),
    state,
    scope: scopes.join(','),
    response_type: 'code',
  });
  return `https://www.facebook.com/${required('META_GRAPH_VERSION')}/dialog/oauth?${params.toString()}`;
}

async function graphJson(path: string, token: string, params: Record<string, string> = {}) {
  const qs = new URLSearchParams({ ...params, access_token: token });
  const res = await fetch(`${graphBase()}/${path.replace(/^\//, '')}?${qs.toString()}`, { cache: 'no-store' });
  const json = await res.json();
  if (!res.ok || json?.error) throw new Error(json?.error?.message || `Meta API ${res.status}`);
  return json;
}

async function graphAll(path: string, token: string, params: Record<string, string>) {
  const rows: any[] = [];
  let next: string | null = `${graphBase()}/${path.replace(/^\//, '')}?${new URLSearchParams({ ...params, access_token: token, limit: '100' }).toString()}`;
  let pages = 0;
  while (next && pages < 10) {
    const res = await fetch(next, { cache: 'no-store' });
    const json = await res.json();
    if (!res.ok || json?.error) throw new Error(json?.error?.message || `Meta API ${res.status}`);
    rows.push(...(json.data || []));
    next = json.paging?.next || null;
    pages += 1;
  }
  return rows;
}

export async function exchangeMetaCode(code: string) {
  const params = new URLSearchParams({
    client_id: required('META_APP_ID'),
    client_secret: required('META_APP_SECRET'),
    redirect_uri: metaRedirectUri(),
    code,
  });
  const shortRes = await fetch(`${graphBase()}/oauth/access_token?${params.toString()}`, { cache: 'no-store' });
  const short = await shortRes.json();
  if (!shortRes.ok || short.error) throw new Error(short.error?.message || 'Meta OAuth exchange failed');

  const longParams = new URLSearchParams({
    grant_type: 'fb_exchange_token',
    client_id: required('META_APP_ID'),
    client_secret: required('META_APP_SECRET'),
    fb_exchange_token: short.access_token,
  });
  const longRes = await fetch(`${graphBase()}/oauth/access_token?${longParams.toString()}`, { cache: 'no-store' });
  const long = await longRes.json();
  if (!longRes.ok || long.error) throw new Error(long.error?.message || 'Meta long-lived token exchange failed');

  const profile = await graphJson('me', long.access_token, { fields: 'id,name' });
  return {
    accessToken: long.access_token as string,
    expiresIn: Number(long.expires_in || short.expires_in || 0),
    profile,
  };
}

export async function syncMetaConnection(args: {
  organizationId: string;
  connectionId: string;
  accessToken: string;
}) {
  const { organizationId, connectionId, accessToken } = args;
  const admin = createAdminClient();

  const [adAccounts, pages] = await Promise.all([
    graphAll('me/adaccounts', accessToken, { fields: 'id,account_id,name,account_status,currency,timezone_name' }),
    graphAll('me/accounts', accessToken, { fields: 'id,name,instagram_business_account{id,username,name}' }),
  ]);

  if (adAccounts.length) {
    await admin.from('meta_ad_accounts').upsert(
      adAccounts.map((x: any) => ({
        organization_id: organizationId,
        connection_id: connectionId,
        ad_account_id: String(x.account_id || x.id || '').replace(/^act_/, ''),
        name: x.name || null,
        currency: x.currency || null,
        timezone_name: x.timezone_name || null,
        account_status: x.account_status ?? null,
        raw: x,
        synced_at: new Date().toISOString(),
      })),
      { onConflict: 'organization_id,ad_account_id' },
    );
  }

  if (pages.length) {
    await admin.from('meta_pages').upsert(
      pages.map((x: any) => ({
        organization_id: organizationId,
        connection_id: connectionId,
        page_id: String(x.id),
        name: x.name || null,
        instagram_business_account_id: x.instagram_business_account?.id || null,
        instagram_username: x.instagram_business_account?.username || null,
        raw: x,
        synced_at: new Date().toISOString(),
      })),
      { onConflict: 'organization_id,page_id' },
    );
  }

  await admin.from('meta_connections').update({ last_synced_at: new Date().toISOString(), status: 'connected', updated_at: new Date().toISOString() }).eq('id', connectionId);
  return { adAccounts: adAccounts.length, pages: pages.length };
}

export async function getMetaAccessToken(connectionId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc('get_meta_credential', { p_connection_id: connectionId });
  if (error || !data) throw new Error('Meta credential unavailable');
  return decryptMetaToken(String(data));
}

export async function getMetaAccountInsights(adAccountId: string, accessToken: string) {
  const json = await graphJson(`act_${adAccountId}/insights`, accessToken, {
    date_preset: 'last_30d',
    level: 'account',
    fields: 'spend,impressions,reach,clicks,ctr,cpc,cpm,actions,action_values,purchase_roas',
  });
  return json.data?.[0] || null;
}

export async function getMetaCampaigns(adAccountId: string, accessToken: string) {
  return graphAll(`act_${adAccountId}/campaigns`, accessToken, {
    fields: 'id,name,status,effective_status,objective,daily_budget,lifetime_budget,updated_time',
  });
}
