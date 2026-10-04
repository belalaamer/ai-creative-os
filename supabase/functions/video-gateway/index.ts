import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
};

Deno.serve(async(req:Request)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  const auth=req.headers.get("Authorization");
  if(!auth) return json({error:"Unauthorized"},401);

  const supabaseUrl=Deno.env.get("SUPABASE_URL")!;
  const anonKey=Deno.env.get("SUPABASE_ANON_KEY")!;
  const client=createClient(supabaseUrl,anonKey,{
    global:{headers:{Authorization:auth}},
    auth:{persistSession:false,autoRefreshToken:false},
  });
  const {data:{user},error:userError}=await client.auth.getUser();
  if(userError||!user) return json({error:"Unauthorized"},401);

  const apiKey=Deno.env.get("VIDEO_PROVIDER_API_KEY");
  const createEndpoint=Deno.env.get("VIDEO_PROVIDER_CREATE_ENDPOINT");
  const statusEndpoint=Deno.env.get("VIDEO_PROVIDER_STATUS_ENDPOINT");
  const model=Deno.env.get("VIDEO_PROVIDER_MODEL");
  if(!apiKey||!createEndpoint||!model) return json({error:"video_provider_not_configured"},424);

  try{
    const body=await req.json();
    const action=body.action==="status"?"status":"create";
    const started=Date.now();

    if(action==="create"){
      const prompt=String(body.prompt||"").trim();
      const imageUrl=String(body.imageUrl||"").trim();
      if(!prompt||!imageUrl) return json({error:"prompt_and_image_required"},400);
      const duration=Math.max(1,Math.min(30,Number(body.durationSeconds||5)));
      const aspectRatio=String(body.aspectRatio||"9:16");
      const response=await fetch(createEndpoint,{
        method:"POST",
        headers:authHeaders(apiKey),
        body:JSON.stringify({model,prompt,image_url:imageUrl,duration,aspect_ratio:aspectRatio}),
      });
      const raw=await response.text();
      if(!response.ok) return json({error:"provider_error",status:response.status,detail:raw.slice(0,500)},502);
      const data=parse(raw);
      return json({
        status:normalizeStatus(data),
        jobId:extractJobId(data),
        videoUrl:extractVideoUrl(data),
        provider:Deno.env.get("VIDEO_PROVIDER_NAME")||"external-video",
        model,
        latencyMs:Date.now()-started,
        estimatedCostUsd:numberEnv("VIDEO_PROVIDER_UNIT_COST_USD"),
        rawStatus:data?.status??data?.data?.status??data?.state??null,
      });
    }

    const jobId=String(body.jobId||"").trim();
    if(!jobId) return json({error:"job_id_required"},400);
    if(!statusEndpoint) return json({error:"video_status_endpoint_not_configured"},424);
    const endpoint=statusEndpoint.includes("{jobId}")
      ? statusEndpoint.replace("{jobId}",encodeURIComponent(jobId))
      : `${statusEndpoint.replace(/\/$/,"")}/${encodeURIComponent(jobId)}`;
    const method=(Deno.env.get("VIDEO_PROVIDER_STATUS_METHOD")||"GET").toUpperCase();
    const response=await fetch(endpoint,{
      method,
      headers:authHeaders(apiKey),
      ...(method==="GET"?{}:{body:JSON.stringify({job_id:jobId,id:jobId})}),
    });
    const raw=await response.text();
    if(!response.ok) return json({error:"provider_error",status:response.status,detail:raw.slice(0,500)},502);
    const data=parse(raw);
    return json({
      status:normalizeStatus(data),
      jobId,
      videoUrl:extractVideoUrl(data),
      progress:extractProgress(data),
      provider:Deno.env.get("VIDEO_PROVIDER_NAME")||"external-video",
      model,
      latencyMs:Date.now()-started,
      rawStatus:data?.status??data?.data?.status??data?.state??null,
    });
  }catch(error){
    return json({error:error instanceof Error?error.message:"unknown_error"},500);
  }
});

function authHeaders(apiKey:string){
  const header=Deno.env.get("VIDEO_PROVIDER_AUTH_HEADER")||"Authorization";
  const prefix=Deno.env.get("VIDEO_PROVIDER_AUTH_PREFIX")??"Bearer ";
  return {"Content-Type":"application/json",[header]:`${prefix}${apiKey}`};
}
function parse(raw:string){try{return JSON.parse(raw)}catch{return {raw}}}
function extractJobId(x:any){return x?.job_id??x?.id??x?.task_id??x?.data?.id??x?.data?.job_id??null}
function extractVideoUrl(x:any){return x?.video_url??x?.url??x?.data?.url??x?.data?.video_url??x?.output?.url??x?.output?.video_url??null}
function extractProgress(x:any){const value=Number(x?.progress??x?.data?.progress??x?.percent??x?.percentage);return Number.isFinite(value)?Math.max(0,Math.min(100,value)):null}
function normalizeStatus(x:any){
  const raw=String(x?.status??x?.data?.status??x?.state??"").toLowerCase();
  if(["succeeded","completed","complete","done","success","ready"].includes(raw)) return "succeeded";
  if(["failed","error","cancelled","canceled"].includes(raw)) return "failed";
  if(extractVideoUrl(x)) return "succeeded";
  return "processing";
}
function numberEnv(name:string){const v=Deno.env.get(name);if(!v)return null;const n=Number(v);return Number.isFinite(n)?n:null}
function json(data:unknown,status=200){return new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json"}})}
