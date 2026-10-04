import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (_req: Request) => {
  const present = (name: string) => Boolean(Deno.env.get(name));
  const data = {
    openaiText: { apiKey: present("OPENAI_API_KEY"), model: present("OPENAI_TEXT_MODEL") },
    openaiImage: { apiKey: present("OPENAI_API_KEY"), model: present("OPENAI_IMAGE_MODEL") },
    openaiSpeech: { apiKey: present("OPENAI_API_KEY"), model: present("OPENAI_SPEECH_MODEL"), voice: Boolean(Deno.env.get("OPENAI_SPEECH_VOICE") || "alloy") },
    video: {
      apiKey: present("VIDEO_PROVIDER_API_KEY"),
      model: present("VIDEO_PROVIDER_MODEL"),
      createEndpoint: present("VIDEO_PROVIDER_CREATE_ENDPOINT"),
      statusEndpoint: present("VIDEO_PROVIDER_STATUS_ENDPOINT"),
    },
    assembly: {
      apiKey: present("MEDIA_ASSEMBLY_API_KEY"),
      endpoint: present("MEDIA_ASSEMBLY_ENDPOINT"),
      statusEndpoint: present("MEDIA_ASSEMBLY_STATUS_ENDPOINT"),
    },
  };
  return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
});
