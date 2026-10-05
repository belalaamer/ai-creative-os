'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CheckCircle2, Link2, Loader2, RefreshCw, Unplug } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

type Account={ad_account_id:string;name:string|null;currency:string|null;timezone_name:string|null;is_selected:boolean};
type PageRow={page_id:string;name:string|null;instagram_business_account_id:string|null;instagram_username:string|null};

export function MetaCenter({
  configured,
  connected,
  connectionName,
  accounts,
  pages,
  canAdmin,
}:{
  configured:boolean;
  connected:boolean;
  connectionName:string|null;
  accounts:Account[];
  pages:PageRow[];
  canAdmin:boolean;
}) {
  const {locale}=useLanguage();
  const ar=locale==='ar';
  const [loading,setLoading]=useState(false);
  const [data,setData]=useState<any>(null);
  const [error,setError]=useState('');

  const selected=useMemo(()=>accounts[0]?.ad_account_id||'', [accounts]);

  useEffect(()=>{
    if(!connected||!selected)return;
    setLoading(true);setError('');
    fetch(`/api/meta/data?account=${encodeURIComponent(selected)}`)
      .then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error||'Meta data failed');return j})
      .then(setData).catch(e=>setError(e.message)).finally(()=>setLoading(false));
  },[connected,selected]);

  async function sync(){
    setLoading(true);setError('');
    try{const r=await fetch('/api/meta/sync',{method:'POST'});const j=await r.json();if(!r.ok)throw new Error(j.error||'Sync failed');window.location.reload();}
    catch(e){setError(e instanceof Error?e.message:'Sync failed');setLoading(false)}
  }

  async function disconnect(){
    if(!confirm(ar?'فصل حساب Meta من مساحة العمل؟':'Disconnect Meta from this workspace?'))return;
    setLoading(true);setError('');
    try{const r=await fetch('/api/meta/disconnect',{method:'POST'});const j=await r.json();if(!r.ok)throw new Error(j.error||'Disconnect failed');window.location.reload();}
    catch(e){setError(e instanceof Error?e.message:'Disconnect failed');setLoading(false)}
  }

  const metric=(key:string)=>data?.insights?.[key]??'—';
  const purchaseRoas=Array.isArray(data?.insights?.purchase_roas)?data.insights.purchase_roas[0]?.value:'—';

  if(!configured) return <div className="meta-setup-state"><Link2 size={24}/><h2>{ar?'Meta Ads لسه محتاج إعداد المطور':'Meta Ads needs developer setup'}</h2><p>{ar?'الكود والبنية جاهزين، لكن لازم تضيف بيانات Meta App في أسرار الإنتاج قبل ما زر الربط يشتغل.':'The integration code is ready, but the Meta App credentials still need to be added to production secrets before connection can work.'}</p></div>;

  if(!connected) return <div className="meta-setup-state"><BarChart3 size={24}/><h2>{ar?'اربط حساب Meta Ads':'Connect Meta Ads'}</h2><p>{ar?'بعد الربط هنقرأ الحسابات الإعلانية والحملات والأداء من داخل Creative OS.':'After connecting, Creative OS can read your ad accounts, campaigns and performance in one place.'}</p>{canAdmin?<a className="creative-primary-action" href="/api/meta/connect"><Link2 size={16}/>{ar?'ربط Meta':'Connect Meta'}</a>:<span className="meta-admin-note">{ar?'لازم Owner أو Admin يعمل الربط.':'An Owner or Admin must connect Meta.'}</span>}</div>;

  return <div className="meta-center">
    <div className="meta-connected-bar"><div><CheckCircle2 size={18}/><span>{ar?'متصل بـ Meta':'Connected to Meta'}</span><b>{connectionName||'Meta'}</b></div><div>{canAdmin&&<button onClick={sync} disabled={loading}><RefreshCw size={15}/>{ar?'مزامنة':'Sync'}</button>}{canAdmin&&<button onClick={disconnect} disabled={loading}><Unplug size={15}/>{ar?'فصل':'Disconnect'}</button>}</div></div>

    {error&&<div className="creative-error">{error}</div>}
    {loading&&!data&&<div className="meta-loading"><Loader2 className="animate-spin"/><span>{ar?'جاري تحميل بيانات Meta...':'Loading Meta data...'}</span></div>}

    <section className="meta-grid">
      <div className="meta-card"><span>{ar?'الحسابات الإعلانية':'Ad accounts'}</span><strong>{accounts.length}</strong><small>{accounts[0]?.name||'—'}</small></div>
      <div className="meta-card"><span>{ar?'صفحات Facebook':'Facebook pages'}</span><strong>{pages.length}</strong><small>{pages[0]?.name||'—'}</small></div>
      <div className="meta-card"><span>Instagram</span><strong>{pages.filter(x=>x.instagram_business_account_id).length}</strong><small>{pages.find(x=>x.instagram_username)?.instagram_username||'—'}</small></div>
      <div className="meta-card"><span>{ar?'الحملات':'Campaigns'}</span><strong>{data?.campaigns?.length??'—'}</strong><small>{ar?'آخر 50 حملة كحد أقصى':'Up to 50 recent campaigns'}</small></div>
    </section>

    <section className="meta-performance">
      <div className="creative-section-title"><div><span className="studio-eyebrow">LAST 30 DAYS</span><h2>{ar?'أداء الحساب':'Account performance'}</h2></div></div>
      <div className="usage-metrics">
        <div className="usage-metric"><div><span>{ar?'الإنفاق':'Spend'}</span><strong>{metric('spend')}</strong></div></div>
        <div className="usage-metric"><div><span>CTR</span><strong>{metric('ctr')}</strong></div></div>
        <div className="usage-metric"><div><span>CPC</span><strong>{metric('cpc')}</strong></div></div>
        <div className="usage-metric"><div><span>ROAS</span><strong>{purchaseRoas}</strong></div></div>
      </div>
    </section>

    <section className="meta-performance">
      <div className="creative-section-title"><div><span className="studio-eyebrow">CAMPAIGNS</span><h2>{ar?'الحملات الحالية':'Current campaigns'}</h2></div></div>
      <div className="usage-table-wrap"><table className="usage-table"><thead><tr><th>{ar?'الاسم':'Name'}</th><th>{ar?'الهدف':'Objective'}</th><th>{ar?'الحالة':'Status'}</th><th>{ar?'آخر تحديث':'Updated'}</th></tr></thead><tbody>{(data?.campaigns||[]).map((c:any)=><tr key={c.id}><td>{c.name}</td><td>{c.objective||'—'}</td><td>{c.effective_status||c.status}</td><td>{c.updated_time||'—'}</td></tr>)}</tbody></table>{data&&!data.campaigns?.length&&<div className="usage-empty">{ar?'لا توجد حملات في الحساب.':'No campaigns found.'}</div>}</div>
    </section>
  </div>;
}
