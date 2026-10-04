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
  const model = Deno.env.get("OPENAI_IMAGE_MODEL");
  if (!apiKey || !model) return json({ error: "openai_image_not_configured" }, 424);

  try {
    const body = await req.json();
    const prompt = String(body.prompt || "").trim();
    if (!prompt) return json({ error: "prompt_required" }, 400);

    const size = normalizeSize(body.size);
    const quality = normalizeQuality(body.quality);
    const outputFormat = body.outputFormat === "jpeg" || body.outputFormat === "webp" ? body.outputFormat : "png";
    const started = Date.now();

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        prompt,
        size,
        quality,
        output_format: outputFormat,
        n: 1,
      }),
    });

    const raw = await response.text();
    if (!response.ok) {
      return json({ error: "provider_error", status: response.status, detail: raw.slice(0, 500) }, 502);
    }

    const payload = JSON.parse(raw);
    const item = payload?.data?.[0];
    const b64 = item?.b64_json || payload?.b64_json;
    if (!b64) return json({ error: "provider_no_image" }, 502);

    return json({
      b64,
      mime: outputFormat === "jpeg" ? "image/jpeg" : outputFormat === "webp" ? "image/webp" : "image/png",
      usage: payload?.usage ?? {},
      provider: "openai",
      model,
      latencyMs: Date.now() - started,
      estimatedCostUsd: numberEnv("OPENAI_IMAGE_UNIT_COST_USD") ?? null,
      revisedPrompt: item?.revised_prompt ?? null,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "unknown_error" }, 500);
  }
});

function normalizeSize(value: unknown) {
  const size = String(value || "1024x1536");
  return ["1024x1024", "1024x1536", "1536x1024"].includes(size) ? size : "1024x1536";
}

function normalizeQuality(value: unknown) {
  const quality = String(value || "medium");
  return ["low", "medium", "high", "auto"].includes(quality) ? quality : "medium";
}

function numberEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
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
