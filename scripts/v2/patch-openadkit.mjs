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
  next: "^14.2.35",
  "@anthropic-ai/sdk": "^0.70.0",
  "@vercel/blob": "^0.27.0"
};
pkg.private=true;
fs.writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+"\n");

const layoutPath=path.join(root,"app","layout.tsx");
if (fs.existsSync(layoutPath)) {
  let layout = fs.readFileSync(layoutPath,"utf8");
  layout = layout.replaceAll("OpenAdKit — Open Source AI Marketing Tool","Creative OS — AI Marketing Studio");
  fs.writeFileSync(layoutPath, layout);
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
