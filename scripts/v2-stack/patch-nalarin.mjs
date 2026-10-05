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


const authContext=path.join(root,"frontend","src","context","AuthContext.jsx");
if(fs.existsSync(authContext)){
  let auth=fs.readFileSync(authContext,"utf8");
  if(!auth.includes("VITE_DEMO_MODE")){
    auth=auth.replace(
      "const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';",
      "const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';\nconst DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';\nconst DEMO_USER = { id: 'preview', email: 'preview@creative-os.local', name: 'Creative OS Preview', is_superuser: true, roles: [{ name: 'admin', permissions: [] }] };"
    );
    auth=auth.replace(
      "const [user, setUser] = useState(null);",
      "const [user, setUser] = useState(DEMO_MODE ? DEMO_USER : null);"
    );
    auth=auth.replace(
      "const [accessToken, setAccessToken] = useState(localStorage.getItem('accessToken'));",
      "const [accessToken, setAccessToken] = useState(DEMO_MODE ? 'preview' : localStorage.getItem('accessToken'));"
    );
    auth=auth.replace(
      "const [loading, setLoading] = useState(true);",
      "const [loading, setLoading] = useState(!DEMO_MODE);"
    );
    auth=auth.replace(
      "const initAuth = async () => {\n            if (accessToken) {",
      "const initAuth = async () => {\n            if (DEMO_MODE) { setLoading(false); return; }\n            if (accessToken) {"
    );
    auth=auth.replace(
      "const authFetch = useCallback(async (url, options = {}) => {\n        const currentToken",
      `const authFetch = useCallback(async (url, options = {}) => {
        if (DEMO_MODE) {
            const pathName = new URL(url, window.location.origin).pathname;
            let payload = {};
            if (pathName.endsWith('/overview')) payload = { campaigns: [], errors: {} };
            else if (pathName.endsWith('/dashboard/stats')) payload = { brands_count: 0, products_count: 0, generated_ads_count: 0, templates_count: 0, campaigns_count: 0 };
            else if (pathName.includes('/optimization')) payload = { recommendations: [], actions: [] };
            return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
        }
        const currentToken`
    );
    fs.writeFileSync(authContext,auth);
  }
}

if(fs.existsSync(layout)){
  let shell=fs.readFileSync(layout,"utf8");
  if(!shell.includes("VITE_DEMO_MODE")){
    shell=shell.replace(
      "const STUDIO_URL = import.meta.env.VITE_STUDIO_URL || '';",
      "const STUDIO_URL = import.meta.env.VITE_STUDIO_URL || '';\nconst DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';"
    );
    shell=shell.replace(
      "<main className=\"flex-1 overflow-y-auto pt-14 md:pt-0\">",
      "<main className=\"flex-1 overflow-y-auto pt-14 md:pt-0\">{DEMO_MODE && <div className=\"sticky top-0 z-30 bg-violet-600 text-white text-xs sm:text-sm text-center px-3 py-2\">Preview mode · Ads backend and live provider credentials are not connected yet.</div>}"
    );
    fs.writeFileSync(layout,shell);
  }
}
