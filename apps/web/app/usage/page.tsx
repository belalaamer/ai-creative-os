'use client';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useLanguage } from '@/lib/i18n';
import { AppShell } from '@/components/app-shell';
import { Coins, DollarSign, Gauge, TrendingUp, ShieldCheck, Activity, RefreshCw, Route, Sparkles } from 'lucide-react';

type Row={id:string;provider_code:string;model_code:string;provider_cost_usd:number;billable_credits:number;revenue_usd:number;gross_margin_usd:number;gross_margin_pct:number|null;created_at:string};
type Health={provider_code:string;status:string;success_rate:number|null;avg_latency_ms:number|null;consecutive_failures:number;updated_at:string};
type Policy={max_provider_cost_per_generation_usd:number;max_provider_cost_per_day_usd:number;max_credits_per_day:number;max_retries_per_provider:number;max_failovers:number;request_timeout_ms:number;moderation_mode:string};

export default function UsagePage(){
  const supabase=useMemo(()=>createClient(),[]); const {t,locale}=useLanguage(); const ar=locale==='ar';
  const [rows,setRows]=useState<Row[]>([]); const [balance,setBalance]=useState(0); const [loading,setLoading]=useState(true);
  const [health,setHealth]=useState<Health[]>([]); const [policy,setPolicy]=useState<Policy|null>(null); const [spentToday,setSpentToday]=useState(0);
  useEffect(()=>{(async()=>{try{
    const {data:{user}}=await supabase.auth.getUser(); if(!user)return;
    const {data:activeOrg}=await supabase.rpc('get_active_organization'); const m=activeOrg?{organization_id:String(activeOrg)}:null; if(!m)return;
    await supabase.rpc('ensure_ai_policy',{p_organization_id:m.organization_id});
    const [{data:costs},{data:wallet},{data:healthRows},{data:policyRow},{data:budget}]=await Promise.all([
      supabase.from('generation_costs').select('*').eq('organization_id',m.organization_id).order('created_at',{ascending:false}).limit(100),
      supabase.from('credit_wallets').select('balance').eq('organization_id',m.organization_id).single(),
      supabase.from('provider_health').select('*').order('updated_at',{ascending:false}),
      supabase.from('organization_ai_policies').select('*').eq('organization_id',m.organization_id).single(),
      supabase.rpc('provider_budget_snapshot',{p_organization_id:m.organization_id})
    ]);
    setRows((costs??[]) as Row[]); setBalance(Number(wallet?.balance??0)); setHealth((healthRows??[]) as Health[]); setPolicy(policyRow as Policy); setSpentToday(Number((budget as any)?.spent_provider_usd_today??0));
  } finally {setLoading(false)}})()},[supabase]);
  const totals=rows.reduce((a,r)=>({cost:a.cost+Number(r.provider_cost_usd||0),credits:a.credits+Number(r.billable_credits||0),revenue:a.revenue+Number(r.revenue_usd||0),margin:a.margin+Number(r.gross_margin_usd||0)}),{cost:0,credits:0,revenue:0,margin:0});
  const marginPct=totals.revenue>0?(totals.margin/totals.revenue)*100:0;
  const healthyCount=health.filter(h=>h.status==='healthy').length;

  return <AppShell credits={balance}>
    <section className="usage-head">
      <div><div className="studio-eyebrow">USAGE & ECONOMICS</div><h1>{t('usageTitle')}</h1><p>{t('usageSubtitle')}</p></div>
      <div className="usage-balance"><Coins size={18}/><span>{t('currentBalance')}</span><strong>{balance.toLocaleString(locale==='ar'?'ar-EG':'en-US')}</strong></div>
    </section>

    <section className="usage-metrics">
      <Metric icon={<DollarSign size={18}/>} title={t('providerCost')} value={`$${totals.cost.toFixed(4)}`} note={ar?'إجمالي تكلفة المزودين':'Total provider spend'}/>
      <Metric icon={<TrendingUp size={18}/>} title={t('estimatedRevenue')} value={`$${totals.revenue.toFixed(4)}`} note={ar?'القيمة التقديرية للـCredits':'Estimated credit value'}/>
      <Metric icon={<Gauge size={18}/>} title={t('grossMargin')} value={`${marginPct.toFixed(1)}%`} note={ar?'الهامش المتوقع':'Estimated margin'}/>
      <Metric icon={<ShieldCheck size={18}/>} title={t('providerHealth')} value={`${healthyCount}/${health.length||0}`} note={ar?'مزودين بحالة سليمة':'Providers currently healthy'}/>
    </section>

    <section className="usage-section">
      <div className="creative-section-title"><div><span className="studio-eyebrow">RELIABILITY</span><h2>{t('resilienceTitle')}</h2><p>{t('resilienceSubtitle')}</p></div></div>
      <div className="usage-reliability">
        <Metric icon={<ShieldCheck size={17}/>} title={t('dailyBudget')} value={policy?`$${Number(policy.max_provider_cost_per_day_usd).toFixed(2)}`:'—'} compact/>
        <Metric icon={<Activity size={17}/>} title={t('dailySpent')} value={`$${spentToday.toFixed(4)}`} compact/>
        <Metric icon={<RefreshCw size={17}/>} title={t('retries')} value={policy?.max_retries_per_provider??'—'} compact/>
        <Metric icon={<Route size={17}/>} title={t('failovers')} value={policy?.max_failovers??'—'} compact/>
      </div>

      <div className="provider-health-panel">
        <div className="provider-health-head"><div><span>{t('moderationMode')}</span><b>{policy?.moderation_mode??'—'}</b></div><div><span>{t('providerHealth')}</span><b>{health.length||0}</b></div></div>
        {health.length>0?<div className="provider-health-grid">{health.map(h=><article key={h.provider_code} className={h.status==='healthy'?'provider-health-card is-ok':'provider-health-card'}>
          <div><span className="provider-status-dot"/><b>{h.provider_code}</b><small>{t(h.status)}</small></div>
          <p>{ar?'الأخطاء المتتالية':'Consecutive failures'}: {h.consecutive_failures}{h.avg_latency_ms?` · ${h.avg_latency_ms} ms`:''}</p>
        </article>)}</div>:<div className="usage-empty"><Sparkles size={18}/><span>{ar?'لا توجد بيانات صحة مزودين حتى الآن':'No provider health data yet'}</span></div>}
      </div>
    </section>

    <section className="usage-section">
      <div className="creative-section-title"><div><span className="studio-eyebrow">COST LEDGER</span><h2>{ar?'سجل التكلفة والاستهلاك':'Cost & usage ledger'}</h2></div></div>
      <div className="usage-table-wrap"><table className="usage-table"><thead><tr><th>{t('provider')}</th><th>{t('model')}</th><th>{t('creditsUsed')}</th><th>{t('providerCost')}</th><th>{t('estimatedRevenue')}</th><th>{t('grossMargin')}</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.provider_code}</td><td>{r.model_code}</td><td>{r.billable_credits}</td><td>${Number(r.provider_cost_usd).toFixed(4)}</td><td>${Number(r.revenue_usd).toFixed(4)}</td><td>{r.gross_margin_pct==null?'—':`${Number(r.gross_margin_pct).toFixed(1)}%`}</td></tr>)}</tbody></table>{!loading&&!rows.length&&<div className="usage-empty"><Sparkles size={18}/><span>{t('noUsageYet')}</span></div>}</div>
    </section>
  </AppShell>;
}
function Metric({icon,title,value,note,compact=false}:{icon:React.ReactNode;title:string;value:string|number;note?:string;compact?:boolean}){return <div className={compact?'usage-metric is-compact':'usage-metric'}><div className="usage-metric-icon">{icon}</div><div><span>{title}</span><strong>{value}</strong>{note&&<p>{note}</p>}</div></div>}
