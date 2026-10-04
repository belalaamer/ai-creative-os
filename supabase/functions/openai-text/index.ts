import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  const auth = req.headers.get("Authorization");
  if (!auth) return response({ error: "Unauthorized" }, 401);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const client = createClient(url, anon, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user } } = await client.auth.getUser();
  if (!user) return response({ error: "Unauthorized" }, 401);

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  const model = Deno.env.get("OPENAI_TEXT_MODEL");
  if (!apiKey || !model) return response({ error: "openai_not_configured" }, 424);

  const body = await req.json();
  const system = String(body.system || "You are a helpful assistant.");
  const prompt = String(body.prompt || "").trim();
  if (!prompt) return response({ error: "prompt_required" }, 400);

  const started = Date.now();
  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, input: [{ role: "system", content: system }, { role: "user", content: prompt }] }),
  });
  const raw = await r.text();
  if (!r.ok) return response({ error: "provider_error", status: r.status, detail: raw.slice(0, 500) }, 502);

  const j = JSON.parse(raw);
  let text = typeof j.output_text === "string" ? j.output_text : "";
  if (!text) {
    const chunks: string[] = [];
    for (const item of Array.isArray(j.output) ? j.output : []) {
      for (const part of Array.isArray(item?.content) ? item.content : []) {
        if (typeof part?.text === "string") chunks.push(part.text);
      }
    }
    text = chunks.join("\n");
  }
  if (!text.trim()) return response({ error: "provider_no_text" }, 502);

  const inputTokens = Number(j?.usage?.input_tokens ?? j?.usage?.prompt_tokens ?? 0);
  const outputTokens = Number(j?.usage?.output_tokens ?? j?.usage?.completion_tokens ?? 0);
  const inputRate = numberEnv("OPENAI_TEXT_INPUT_COST_PER_MILLION_USD");
  const outputRate = numberEnv("OPENAI_TEXT_OUTPUT_COST_PER_MILLION_USD");
  const estimatedCostUsd = inputRate == null && outputRate == null ? null
    : (inputTokens / 1_000_000) * (inputRate ?? 0) + (outputTokens / 1_000_000) * (outputRate ?? 0);

  return response({ text, usage: j.usage ?? {}, provider: "openai", model, latencyMs: Date.now() - started, estimatedCostUsd });
});

function numberEnv(name: string) {
  const v = Deno.env.get(name);
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}
