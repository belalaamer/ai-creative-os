import fs from "node:fs";
import path from "node:path";

const root=process.argv[2];
if(!root||!fs.existsSync(root)) throw new Error("Nalarin checkout not found");

const authPath=path.join(root,"frontend","src","context","AuthContext.jsx");
if(fs.existsSync(authPath)){
  let auth=fs.readFileSync(authPath,"utf8");
  auth=auth.replace(
    "if (pathName.endsWith('/overview')) payload = { campaigns: [], errors: {} };",
    `if (pathName.endsWith('/overview')) payload = {
                campaigns: [
                    { platform: 'meta', campaign_name: 'Recovery Offer · New Cairo', impressions: 84210, clicks: 2418, spend: 486.20, conversions: 91, cpa: 5.34 },
                    { platform: 'google', campaign_name: 'High Intent Search · Physio', impressions: 31680, clicks: 1834, spend: 392.40, conversions: 74, cpa: 5.30 },
                    { platform: 'tiktok', campaign_name: 'Back In Motion · Video Test', impressions: 126400, clicks: 3217, spend: 355.80, conversions: 52, cpa: 6.84 }
                ],
                errors: {}
            };`
  );
  auth=auth.replace(
    "else if (pathName.endsWith('/dashboard/stats')) payload = { brands_count: 0, products_count: 0, generated_ads_count: 0, templates_count: 0, campaigns_count: 0 };",
    "else if (pathName.endsWith('/dashboard/stats')) payload = { brands_count: 3, products_count: 12, generated_ads_count: 48, templates_count: 24, campaigns_count: 9 };"
  );
  auth=auth.replace(
    "allowed_actions: [],",
    "allowed_actions: ['campaign.pause', 'budget.adjust', 'creative.rotate'],"
  );
  auth=auth.replace(
    "max_budget_micros: null,",
    "max_budget_micros: 250000000,"
  );
  auth=auth.replace(
    "max_daily_spend_micros: null,",
    "max_daily_spend_micros: 75000000,"
  );
  fs.writeFileSync(authPath,auth);
}

const dashboardPath=path.join(root,"frontend","src","pages","Dashboard.jsx");
if(fs.existsSync(dashboardPath)){
  let dash=fs.readFileSync(dashboardPath,"utf8");
  if(!dash.includes("Preview workspace · sample data")){
    dash=dash.replace(
      '<p className="text-gray-600 mt-2">Welcome to your Ad Builder workspace</p>',
      '<p className="text-gray-600 mt-2">Welcome to your AI Creative & Paid Media workspace</p><p className="mt-2 inline-flex rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">Preview workspace · sample data</p>'
    );
    fs.writeFileSync(dashboardPath,dash);
  }
}
