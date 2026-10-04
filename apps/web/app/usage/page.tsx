'use client';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useLanguage } from '@/lib/i18n';
import { AppShell } from '@/components/app-shell';
import { Coins, DollarSign, Gauge, TrendingUp, ShieldCheck, Activity, RefreshCw, Route } from 'lucide-react';

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
  return <AppShell credits={balance}>
    <section>
      <h1 className="text-4xl font-black">{t('usageTitle')}</h1><p className="mt-2 text-zinc-500">{t('usageSubtitle')}</p>
      <div className="mt-6 grid gap-4 md:grid-cols-4">
        <Card icon={<Coins size={18}/>} title={t('currentBalance')} value={balance.toLocaleString(locale==='ar'?'ar-EG':'en-US')}/>
        <Card icon={<DollarSign size={18}/>} title={t('providerCost')} value={`$${totals.cost.toFixed(4)}`}/>
        <Card icon={<TrendingUp size={18}/>} title={t('estimatedRevenue')} value={`$${totals.revenue.toFixed(4)}`}/>
        <Card icon={<Gauge size={18}/>} title={t('grossMargin')} value={`${marginPct.toFixed(1)}%`}/>
      </div>

      <div className="mt-8"><h2 className="text-2xl font-black">{t('resilienceTitle')}</h2><p className="mt-1 text-zinc-500">{t('resilienceSubtitle')}</p>
        <div className="mt-4 grid gap-4 md:grid-cols-4">
          <Card icon={<ShieldCheck size={18}/>} title={t('dailyBudget')} value={policy?`$${Number(policy.max_provider_cost_per_day_usd).toFixed(2)}`:'—'}/>
          <Card icon={<Activity size={18}/>} title={t('dailySpent')} value={`$${spentToday.toFixed(4)}`}/>
          <Card icon={<RefreshCw size={18}/>} title={t('retries')} value={policy?.max_retries_per_provider??'—'}/>
          <Card icon={<Route size={18}/>} title={t('failovers')} value={policy?.max_failovers??'—'}/>
        </div>
        <div className="card mt-4 p-5">
          <div className="flex items-center justify-between gap-4"><div><div className="text-sm font-bold">{t('moderationMode')}</div><div className="mt-1 text-zinc-500">{policy?.moderation_mode??'—'}</div></div><div className="text-end"><div className="text-sm font-bold">{t('providerHealth')}</div><div className="mt-1 text-zinc-500">{health.length||0}</div></div></div>
          {health.length>0&&<div className="mt-4 grid gap-3 md:grid-cols-2">{health.map(h=><div key={h.provider_code} className="rounded-xl border border-zinc-800 p-4"><div className="flex items-center justify-between"><span className="font-bold">{h.provider_code}</span><span className="text-sm text-zinc-400">{t(h.status)}</span></div><div className="mt-2 text-xs text-zinc-500">{ar?'الأخطاء المتتالية':'Consecutive failures'}: {h.consecutive_failures}{h.avg_latency_ms?` · ${h.avg_latency_ms} ms`:''}</div></div>)}</div>}
        </div>
      </div>

      <div className="card mt-6 overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="border-b border-zinc-800 text-zinc-500"><tr><th className="p-4 text-start">{t('provider')}</th><th className="p-4 text-start">{t('model')}</th><th className="p-4 text-end">{t('creditsUsed')}</th><th className="p-4 text-end">{t('providerCost')}</th><th className="p-4 text-end">{t('estimatedRevenue')}</th><th className="p-4 text-end">{t('grossMargin')}</th></tr></thead><tbody>{rows.map(r=><tr key={r.id} className="border-b border-zinc-900"><td className="p-4">{r.provider_code}</td><td className="p-4 text-zinc-400">{r.model_code}</td><td className="p-4 text-end">{r.billable_credits}</td><td className="p-4 text-end">${Number(r.provider_cost_usd).toFixed(4)}</td><td className="p-4 text-end">${Number(r.revenue_usd).toFixed(4)}</td><td className="p-4 text-end">{r.gross_margin_pct==null?'—':`${Number(r.gross_margin_pct).toFixed(1)}%`}</td></tr>)}</tbody></table>{!loading&&!rows.length&&<div className="p-8 text-center text-zinc-500">{t('noUsageYet')}</div>}</div></div>
    </section>
  </AppShell>;
}
function Card({icon,title,value}:{icon:React.ReactNode;title:string;value:string|number}){return <div className="card p-5"><div className="flex items-center gap-2 text-violet-300">{icon}<span className="text-xs font-bold uppercase tracking-wider">{title}</span></div><div className="mt-3 text-3xl font-black">{value}</div></div>}
