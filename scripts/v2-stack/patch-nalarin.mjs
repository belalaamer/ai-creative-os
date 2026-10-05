import fs from "node:fs";
import path from "node:path";

const root=process.argv[2];
if(!root||!fs.existsSync(root)) throw new Error("Nalarin checkout not found");

const branding=path.join(root,"frontend","src","lib","branding.js");
if(fs.existsSync(branding)){
  let c=fs.readFileSync(branding,"utf8");
  c=c
    .replace("'Agentic Ads Studio'","'Creative OS'")
    .replace("'Paid media operations'","'AI Creative & Paid Media OS'")
    .replace("'Your Company'","'Creative OS'");
  fs.writeFileSync(branding,c);
}

const layout=path.join(root,"frontend","src","components","Layout.jsx");
if(fs.existsSync(layout)){
  let c=fs.readFileSync(layout,"utf8");
  if(!c.includes("VITE_STUDIO_URL")){
    c=c.replace(
      "import { APP_NAME, APP_LOGO, APP_TAGLINE } from '../lib/branding';",
      "import { APP_NAME, APP_LOGO, APP_TAGLINE } from '../lib/branding';\n\nconst STUDIO_URL = import.meta.env.VITE_STUDIO_URL || '';"
    );
    c=c.replace(
      "{ icon: Wand2, label: 'Build Creatives', path: '/build-creatives' },",
      "{ icon: Wand2, label: 'Build Creatives', path: '/build-creatives' },"
    );
    const marker="                <nav className=\"flex-1 p-4 space-y-1 overflow-y-auto overflow-x-hidden\">";
    c=c.replace(marker,marker+`
                    {STUDIO_URL && (
                      <a href={STUDIO_URL} className={\`flex items-center gap-3 px-4 py-3 rounded-xl bg-violet-50 text-violet-900 font-medium hover:bg-violet-100 transition-colors \${isCollapsed ? 'justify-center px-2' : ''}\`} title={isCollapsed ? 'Creative Studio' : ''}>
                        <Wand2 size={20} className="text-violet-600 flex-shrink-0" />
                        {!isCollapsed && <span className="whitespace-nowrap overflow-hidden">Creative Studio</span>}
                      </a>
                    )}
`);
    fs.writeFileSync(layout,c);
  }
}
