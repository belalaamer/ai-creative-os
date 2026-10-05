"use client";

import type { StudioClientConfig } from "@two-71/studio";
import { Studio } from "@two-71/studio/client";

const config: StudioClientConfig = {
  branding: {
    siteName: "Creative OS Studio",
  },
  coinName: "credits",
  features: {
    billing: false,
    enhance: false,
    video: true,
  },
  models: [
    {
      id: "creative-image",
      name: "Creative Image",
      description: "Generate campaign-ready social ad visuals from a prompt.",
      ratios: ["1:1","4:3","3:4","16:9","9:16"],
      resolutions: ["Standard","High","Ultra"],
      coinCost: 0,
      loras: [],
      poses: [],
    },
    {
      id: "product-studio",
      name: "Product Studio",
      description: "Product-first creative generation with reference-image controls.",
      ratios: ["1:1","4:3","3:4","16:9","9:16"],
      resolutions: ["Standard","High","Ultra"],
      coinCost: 0,
      loras: [],
      poses: [],
    },
  ],
  video: {
    durations: [5,10],
    coinsPerSecond: 0,
  },
  apiBasePath: "/preview-api",
};

function PreviewActions(){
  return <div className="flex items-center gap-2">
    <span className="hidden rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-300 sm:inline">Preview</span>
    <a href="https://ai-creative-os-v2-ads.pages.dev" className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-white/10">Ads Center</a>
  </div>;
}

export default function Page(){
  return <Studio
    config={config}
    user={{name:"Creative OS Preview",email:"preview@creative-os.local"}}
    loginUrl="/"
    headerActions={<PreviewActions/>}
    notchWidth={360}
  />;
}
