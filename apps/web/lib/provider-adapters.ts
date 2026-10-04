import type { ProviderConfig } from './provider-router';

export type TextAdapterResult = {
  text: string;
  usage?: Record<string, unknown>;
  raw?: unknown;
};

export type BinaryAdapterResult = {
  bytes: Uint8Array;
  mime: string;
  usage?: Record<string, unknown>;
  raw?: unknown;
};

function adapterName(config: ProviderConfig) {
  const explicit = config.adapter?.trim().toLowerCase();
  if (explicit) return explicit;
  const provider = config.provider.toLowerCase();
  const endpoint = config.endpoint.toLowerCase();
  if (provider.includes('openai') && endpoint.includes('/responses')) return 'openai-responses';
  if (provider.includes('openai') && endpoint.includes('/images/')) return 'openai-images';
  if (provider.includes('openai') && endpoint.includes('/audio/speech')) return 'openai-speech';
  if (endpoint.includes('/responses')) return 'openai-responses';
  if (endpoint.includes('/images/generations')) return 'openai-images';
  if (endpoint.includes('/audio/speech')) return 'openai-speech';
  return 'generic';
}

function extractResponsesText(json: any): string | null {
  if (typeof json?.output_text === 'string' && json.output_text.trim()) return json.output_text;
  const output = Array.isArray(json?.output) ? json.output : [];
  const chunks: string[] = [];
  for (const item of output) {
    const content = Array.isArray(item?.content) ? item.content : [];
    for (const part of content) {
      const text = part?.text ?? part?.output_text;
      if (typeof text === 'string') chunks.push(text);
    }
  }
  return chunks.length ? chunks.join('\n') : null;
}

export async function callTextProvider(
  config: ProviderConfig,
  input: { system: string; user: string; signal: AbortSignal; jsonOnly?: boolean; temperature?: number },
): Promise<TextAdapterResult> {
  const adapter = adapterName(config);
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` };

  if (adapter === 'openai-responses') {
    const response = await fetch(config.endpoint, {
      method: 'POST', signal: input.signal, headers,
      body: JSON.stringify({
        model: config.model,
        input: [
          { role: 'system', content: input.system },
          { role: 'user', content: input.user },
        ],
      }),
    });
    if (!response.ok) throw new Error(`OpenAI Responses provider failed: ${response.status}`);
    const json: any = await response.json();
    const text = extractResponsesText(json);
    if (!text) throw new Error('OpenAI Responses provider returned no text');
    return { text, usage: json?.usage, raw: json };
  }

  const response = await fetch(config.endpoint, {
    method: 'POST', signal: input.signal, headers,
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: input.system },
        { role: 'user', content: input.user },
      ],
      ...(input.jsonOnly ? { response_format: { type: 'json_object' } } : {}),
      temperature: input.temperature ?? 0.7,
    }),
  });
  if (!response.ok) throw new Error(`Text provider failed: ${response.status}`);
  const json: any = await response.json();
  const text = json?.choices?.[0]?.message?.content ?? json?.text ?? json?.output_text;
  if (typeof text !== 'string' || !text.trim()) throw new Error('Text provider returned no content');
  return { text, usage: json?.usage, raw: json };
}

export async function callImageProvider(
  config: ProviderConfig,
  input: { prompt: string; signal: AbortSignal; size?: string; quality?: string },
): Promise<BinaryAdapterResult> {
  const adapter = adapterName(config);
  const response = await fetch(config.endpoint, {
    method: 'POST', signal: input.signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      model: config.model,
      prompt: input.prompt,
      size: input.size ?? '1024x1536',
      ...(input.quality ? { quality: input.quality } : {}),
    }),
  });
  if (!response.ok) throw new Error(`${adapter === 'openai-images' ? 'OpenAI Images' : 'Image'} provider failed: ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  if (contentType.startsWith('image/')) {
    return { bytes: new Uint8Array(await response.arrayBuffer()), mime: contentType };
  }
  const json: any = await response.json();
  const first = json?.data?.[0] ?? json;
  const b64 = first?.b64_json ?? first?.image_base64 ?? json?.image_base64;
  if (b64) return { bytes: Uint8Array.from(Buffer.from(b64, 'base64')), mime: first?.mime_type ?? 'image/png', usage: json?.usage, raw: json };
  const remoteUrl = first?.url ?? first?.image_url ?? json?.image_url;
  if (remoteUrl) {
    const file = await fetch(remoteUrl, { signal: input.signal });
    if (!file.ok) throw new Error(`Image download failed: ${file.status}`);
    return { bytes: new Uint8Array(await file.arrayBuffer()), mime: file.headers.get('content-type') || 'image/png', usage: json?.usage, raw: json };
  }
  throw new Error('Image provider returned no image');
}

export async function callVoiceProvider(
  config: ProviderConfig,
  input: { text: string; locale: 'ar' | 'en'; signal: AbortSignal; format?: string },
): Promise<BinaryAdapterResult> {
  const adapter = adapterName(config);
  const body = adapter === 'openai-speech'
    ? { model: config.model, input: input.text, voice: config.voice || 'alloy', format: input.format || 'mp3' }
    : { model: config.model, text: input.text, language: input.locale, voice: config.voice || 'default', format: input.format || 'mp3' };
  const response = await fetch(config.endpoint, {
    method: 'POST', signal: input.signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`Voice provider failed: ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  if (contentType.startsWith('audio/')) return { bytes: new Uint8Array(await response.arrayBuffer()), mime: contentType };
  const json: any = await response.json();
  const b64 = json?.audio_base64 ?? json?.data?.audio_base64 ?? json?.b64_json;
  if (b64) return { bytes: Uint8Array.from(Buffer.from(b64, 'base64')), mime: json?.mime_type || 'audio/mpeg', usage: json?.usage, raw: json };
  const remoteUrl = json?.audio_url ?? json?.url ?? json?.data?.url;
  if (remoteUrl) {
    const file = await fetch(remoteUrl, { signal: input.signal });
    if (!file.ok) throw new Error(`Voice download failed: ${file.status}`);
    return { bytes: new Uint8Array(await file.arrayBuffer()), mime: file.headers.get('content-type') || 'audio/mpeg', usage: json?.usage, raw: json };
  }
  throw new Error('Voice provider returned no audio');
}

export function parseJsonObject<T = any>(text: string): T {
  const trimmed = text.trim();
  try { return JSON.parse(trimmed) as T; } catch {}
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  if (fenced) return JSON.parse(fenced) as T;
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1)) as T;
  throw new Error('Provider returned invalid JSON');
}
