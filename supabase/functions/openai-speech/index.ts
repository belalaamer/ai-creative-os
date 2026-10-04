import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const auth = req.headers.get("Authorization");
  if (!auth) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: "Unauthorized" }, 401);

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  const model = Deno.env.get("OPENAI_SPEECH_MODEL");
  const defaultVoice = Deno.env.get("OPENAI_SPEECH_VOICE") || "alloy";
  if (!apiKey || !model) return json({ error: "openai_speech_not_configured" }, 424);

  try {
    const body = await req.json();
    const input = String(body.input || "").trim();
    if (!input) return json({ error: "input_required" }, 400);
    if (input.length > 4096) return json({ error: "input_too_long", maxChars: 4096 }, 400);

    const voice = String(body.voice || defaultVoice);
    const responseFormat = normalizeFormat(body.responseFormat);
    const speed = normalizeSpeed(body.speed);
    const instructions = body.instructions ? String(body.instructions) : undefined;
    const started = Date.now();

    const providerResponse = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input,
        voice,
        response_format: responseFormat,
        speed,
        ...(instructions ? { instructions } : {}),
      }),
    });

    if (!providerResponse.ok) {
      const raw = await providerResponse.text();
      return json({ error: "provider_error", status: providerResponse.status, detail: raw.slice(0, 500) }, 502);
    }

    const bytes = new Uint8Array(await providerResponse.arrayBuffer());
    const b64 = toBase64(bytes);
    return json({
      b64,
      mime: mimeFor(responseFormat),
      provider: "openai",
      model,
      voice,
      latencyMs: Date.now() - started,
      estimatedCostUsd: estimateSpeechCost(input.length),
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "unknown_error" }, 500);
  }
});

function normalizeFormat(value: unknown) {
  const format = String(value || "mp3");
  return ["mp3", "opus", "aac", "flac", "wav", "pcm"].includes(format) ? format : "mp3";
}

function normalizeSpeed(value: unknown) {
  const speed = Number(value ?? 1);
  if (!Number.isFinite(speed)) return 1;
  return Math.max(0.25, Math.min(4, speed));
}

function estimateSpeechCost(characters: number) {
  const rate = Number(Deno.env.get("OPENAI_SPEECH_COST_PER_1K_CHARS_USD") || "");
  if (!Number.isFinite(rate)) return null;
  return (characters / 1000) * rate;
}

function mimeFor(format: string) {
  const map: Record<string, string> = {
    mp3: "audio/mpeg",
    opus: "audio/opus",
    aac: "audio/aac",
    flac: "audio/flac",
    wav: "audio/wav",
    pcm: "audio/L16",
  };
  return map[format] || "application/octet-stream";
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
