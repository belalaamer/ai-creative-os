import fs from "node:fs";
import path from "node:path";

const root=process.argv[2];
if(!root||!fs.existsSync(root)) throw new Error("two-71 Studio checkout not found");

const config=path.join(root,"apps","demo","studio.config.ts");
if(fs.existsSync(config)){
  let c=fs.readFileSync(config,"utf8");
  c=c.replace('siteName: "2.71"','siteName: "Creative OS Studio"');
  fs.writeFileSync(config,c);
}

const client=path.join(root,"apps","demo","app","studio","studio-client.tsx");
if(fs.existsSync(client)){
  let c=fs.readFileSync(client,"utf8");
  if(!c.includes("NEXT_PUBLIC_ADS_URL")){
    c=c.replace(
      'export const StudioClient = ({',
      'const ADS_URL = process.env.NEXT_PUBLIC_ADS_URL || "";\n\nexport const StudioClient = ({'
    );
    c=c.replace(
      'headerActions={<StudioThemeSwitcher />}',
      'headerActions={<div className="flex items-center gap-2">{ADS_URL && <a className="rounded-md border px-3 py-1.5 text-sm" href={ADS_URL}>Ads Center</a>}<StudioThemeSwitcher /></div>}'
    );
    fs.writeFileSync(client,c);
  }
}
