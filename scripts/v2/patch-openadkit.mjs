import fs from "node:fs";
import path from "node:path";

const root = process.argv[2];
if (!root || !fs.existsSync(root)) {
  console.error("OpenAdKit checkout not found");
  process.exit(1);
}

// Keep upstream source intact. Broad string replacement can corrupt TypeScript
// identifiers and object keys; white-label only the files we explicitly own below.

const metaHtmlPath = path.join(root,"public","meta-launch.html");
if (fs.existsSync(metaHtmlPath)) {
  let html = fs.readFileSync(metaHtmlPath,"utf8");
  html = html
    .replaceAll("Sobe Tudo","Creative OS · Meta Ads")
    .replaceAll("Campanhas no Facebook com IA","Meta Ads Campaign Launcher")
    .replaceAll("Subir Campanha","Launch Campaign")
    .replaceAll("Conexões","Connections");
  fs.writeFileSync(metaHtmlPath, html);
}

const pkgPath=path.join(root,"package.json");
const pkg=JSON.parse(fs.readFileSync(pkgPath,"utf8"));
pkg.name="@ai-creative-os/v2";
pkg.dependencies = {
  ...(pkg.dependencies || {}),
  next: "^15.5.27",
  "@anthropic-ai/sdk": "^0.70.0",
  "@vercel/blob": "^0.27.0"
};
pkg.private=true;
pkg.devDependencies = {
  ...(pkg.devDependencies || {}),
  "@opennextjs/cloudflare": "latest",
  "wrangler": "latest"
};
pkg.scripts = {
  ...(pkg.scripts || {}),
  "cf:build": "opennextjs-cloudflare build",
  "cf:deploy": "opennextjs-cloudflare build && wrangler deploy"
};
fs.writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+"\n");

fs.writeFileSync(path.join(root,"open-next.config.ts"), `import { defineCloudflareConfig } from "@opennextjs/cloudflare";
export default defineCloudflareConfig();
`);
fs.writeFileSync(path.join(root,"wrangler.jsonc"), JSON.stringify({
  "$schema": "./node_modules/wrangler/config-schema.json",
  name: "ai-creative-os-v2",
  main: ".open-next/worker.js",
  compatibility_date: "2026-10-05",
  compatibility_flags: ["nodejs_compat"],
  assets: { directory: ".open-next/assets", binding: "ASSETS" },
  observability: { enabled: true }
}, null, 2)+"\n");

const layoutPath=path.join(root,"app","layout.tsx");
if (fs.existsSync(layoutPath)) {
  let layout = fs.readFileSync(layoutPath,"utf8");
  layout = layout.replaceAll("OpenAdKit — Open Source AI Marketing Tool","Creative OS — AI Marketing Studio");
  fs.writeFileSync(layoutPath, layout);
}


// Next 14.2.35 tightened useSearchParams() typing during production builds.

const next15Pages = [
  {
    file: path.join(root,"app","learn","[concept]","page.tsx"),
    from: 'export default function Page({ params }: { params: { concept: string } }) {\n  return <ConceptClient concept={params.concept} />;\n}',
    to: 'export default async function Page({ params }: { params: Promise<{ concept: string }> }) {\n  const { concept } = await params;\n  return <ConceptClient concept={concept} />;\n}'
  },
  {
    file: path.join(root,"app","learn","courses","[course]","page.tsx"),
    from: 'export default function Page({ params }: { params: { course: string } }) {\n  return <CourseClient course={params.course} />;\n}',
    to: 'export default async function Page({ params }: { params: Promise<{ course: string }> }) {\n  const { course } = await params;\n  return <CourseClient course={course} />;\n}'
  },
  {
    file: path.join(root,"app","learn","courses","[course]","[lesson]","page.tsx"),
    from: 'export default function Page({ params }: { params: { course: string; lesson: string } }) {\n  return <LessonClient course={params.course} lesson={params.lesson} />;\n}',
    to: 'export default async function Page({ params }: { params: Promise<{ course: string; lesson: string }> }) {\n  const { course, lesson } = await params;\n  return <LessonClient course={course} lesson={lesson} />;\n}'
  },
  {
    file: path.join(root,"app","platforms","[platform]","page.tsx"),
    from: 'export default function Page({ params }: { params: { platform: string } }) {\n  return <PlatformClient platform={params.platform} />;\n}',
    to: 'export default async function Page({ params }: { params: Promise<{ platform: string }> }) {\n  const { platform } = await params;\n  return <PlatformClient platform={platform} />;\n}'
  }
];
for (const item of next15Pages) {
  if (!fs.existsSync(item.file)) continue;
  const original = fs.readFileSync(item.file,"utf8");
  fs.writeFileSync(item.file, original.replace(item.from,item.to));
}

const nextConfigPath = path.join(root,"next.config.mjs");
if (fs.existsSync(nextConfigPath)) {
  let config = fs.readFileSync(nextConfigPath,"utf8");
  config = config.replace('experimental: { typedRoutes: false },','typedRoutes: false,');
  fs.writeFileSync(nextConfigPath, config);
}

const brandPagePath = path.join(root,"app","brand","page.tsx");
if (fs.existsSync(brandPagePath)) {
  let brandPage = fs.readFileSync(brandPagePath,"utf8");
  brandPage = brandPage.replace('const isFirst = params.get("first") === "1";','const isFirst = params?.get("first") === "1";');
  fs.writeFileSync(brandPagePath,brandPage);
}

const pagePath=path.join(root,"app","page.tsx");
if (fs.existsSync(pagePath)) {
  let page=fs.readFileSync(pagePath,"utf8");
  if (!page.includes('href: "/meta-launch.html"')) {
    const marker='const tiles: { href: string; label: string; sub: string; icon: any; accent?: boolean }[] = [';
    page=page.replace(marker, marker+'\n  { href: "/meta-launch.html", label: "Meta Ads Live", sub: "Connect, review and launch paid campaigns from the same workspace", icon: Rocket, accent: true },');
    fs.writeFileSync(pagePath,page);
  }
}

const notice=path.join(root,"UPSTREAM-NOTICES.md");
fs.writeFileSync(notice,`# Upstream notices

Creative OS V2 is based on OpenAdKit (MIT) and incorporates concepts/code adapted from Sobe Tudo (MIT).
Original license and notice files are intentionally preserved in the generated source tree.
`);
