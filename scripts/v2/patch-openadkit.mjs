import fs from "node:fs";
import path from "node:path";

const root = process.argv[2];
if (!root || !fs.existsSync(root)) {
  console.error("OpenAdKit checkout not found");
  process.exit(1);
}

const skip = new Set(["LICENSE","NOTICE.md","README.md","SECURITY.md","CODE_OF_CONDUCT.md","CONTRIBUTING.md"]);
const allowed = new Set([".ts",".tsx",".js",".mjs",".cjs",".json",".css",".html",".svg",".txt",".webmanifest"]);

function walk(dir) {
  for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
    if (entry.name === ".git" || entry.name === "node_modules" || entry.name === ".next") continue;
    const full=path.join(dir,entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (skip.has(entry.name) || !allowed.has(path.extname(entry.name))) continue;
    let text;
    try { text=fs.readFileSync(full,"utf8"); } catch { continue; }
    text=text
      .replaceAll("OpenAdKit","Creative OS")
      .replaceAll("openadkit","creative-os")
      .replaceAll("AdForge","Creative OS");
    fs.writeFileSync(full,text);
  }
}

walk(root);

const pkgPath=path.join(root,"package.json");
const pkg=JSON.parse(fs.readFileSync(pkgPath,"utf8"));
pkg.name="@ai-creative-os/v2";
pkg.private=true;
fs.writeFileSync(pkgPath,JSON.stringify(pkg,null,2)+"\n");

const pagePath=path.join(root,"app","page.tsx");
if (fs.existsSync(pagePath)) {
  let page=fs.readFileSync(pagePath,"utf8");
  if (!page.includes('href: "/meta-live"')) {
    const marker='const tiles: { href: string; label: string; sub: string; icon: any; accent?: boolean }[] = [';
    page=page.replace(marker, marker+'\n  { href: "/meta-live", label: "Meta Ads Live", sub: "Connect, review and launch paid campaigns from the same workspace", icon: Rocket, accent: true },');
    fs.writeFileSync(pagePath,page);
  }
}

const notice=path.join(root,"UPSTREAM-NOTICES.md");
fs.writeFileSync(notice,`# Upstream notices

Creative OS V2 is based on OpenAdKit (MIT) and incorporates concepts/code adapted from Sobe Tudo (MIT).
Original license and notice files are intentionally preserved in the generated source tree.
`);
