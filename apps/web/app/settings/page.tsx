'use client';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { getActiveOrganizationId } from '@/lib/active-org';
import { useLanguage } from '@/lib/i18n';
import { AppShell } from '@/components/app-shell';
import { Bot, CheckCircle2, CircleAlert, CreditCard, RefreshCw, Settings2, Shield, Users } from 'lucide-react';

type Member={user_id:string;role:string;created_at:string}; type Invite={id:string;email:string;role:string;status:string;expires_at:string}; type ProviderSetting={id?:string;kind:string;quality_tier:string;provider_code:string;model_code:string;env_prefix:string;priority:number;enabled:boolean;is_fallback:boolean};
export default function SettingsPage(){
  const supabase=useMemo(()=>createClient(),[]); const {t,locale}=useLanguage(); const ar=locale==='ar';
  const [orgId,setOrgId]=useState(''); const [role,setRole]=useState('viewer'); const [members,setMembers]=useState<Member[]>([]); const [invites,setInvites]=useState<Invite[]>([]); const [email,setEmail]=useState(''); const [inviteRole,setInviteRole]=useState('editor'); const [inviteUrl,setInviteUrl]=useState(''); const [message,setMessage]=useState('');
  const [policy,setPolicy]=useState<any>(null); const [providers,setProviders]=useState<ProviderSetting[]>([]); const [subscription,setSubscription]=useState<any>(null); const [plan,setPlan]=useState<any>(null); const [readiness,setReadiness]=useState<any>(null); const [loading,setLoading]=useState(true);
  async function token(){const {data:{session}}=await supabase.auth.getSession();return session?.access_token||''}
  async function load(){setLoading(true);try{const {data:{user}}=await supabase.auth.getUser();if(!user)return;const oid=await getActiveOrganizationId(supabase);setOrgId(oid);const [{data:me},{data:ms},{data:is},{data:p},{data:ps},{data:sub}]=await Promise.all([supabase.from('organization_members').select('role').eq('organization_id',oid).eq('user_id',user.id).single(),supabase.from('organization_members').select('user_id,role,created_at').eq('organization_id',oid).order('created_at'),supabase.from('team_invitations').select('id,email,role,status,expires_at').eq('organization_id',oid).order('created_at',{ascending:false}),supabase.from('organization_ai_policies').select('*').eq('organization_id',oid).single(),supabase.from('organization_provider_settings').select('*').eq('organization_id',oid).order('kind').order('quality_tier'),supabase.from('organization_subscriptions').select('*').eq('organization_id',oid).single()]);setRole(me?.role||'viewer');setMembers((ms||[]) as Member[]);setInvites((is||[]) as Invite[]);setPolicy(p);setProviders((ps||[]) as ProviderSetting[]);setSubscription(sub);if(sub?.plan_key){const {data:bp}=await supabase.from('billing_plans').select('*').eq('plan_key',sub.plan_key).single();setPlan(bp)}const tok=await token();if(tok){const rr=await fetch('/api/admin/readiness',{headers:{Authorization:`Bearer ${tok}`}});if(rr.ok)setReadiness(await rr.json());}}finally{setLoading(false)}}
  useEffect(()=>{load()},[]);
  async function invite(){setMessage('');setInviteUrl('');const tok=await token();const r=await fetch('/api/admin/invitations',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${tok}`},body:JSON.stringify({email,role:inviteRole})});const j=await r.json();if(!r.ok){setMessage(j.error||t('genericError'));return;}setInviteUrl(j.inviteUrl);setEmail('');await load()}
  async function revoke(id:string){const tok=await token();await fetch(`/api/admin/invitations/${id}`,{method:'DELETE',headers:{Authorization:`Bearer ${tok}`}});await load()}
  async function changeMember(userId:string,nextRole:string){const tok=await token();const r=await fetch(`/api/admin/members/${userId}`,{method:'PATCH',headers:{'Content-Type':'application/json',Authorization:`Bearer ${tok}`},body:JSON.stringify({role:nextRole})});if(!r.ok){const j=await r.json();setMessage(j.error||t('genericError'))}await load()}
  async function removeMember(userId:string){const tok=await token();await fetch(`/api/admin/members/${userId}`,{method:'DELETE',headers:{Authorization:`Bearer ${tok}`}});await load()}
  async function savePolicy(){if(!policy)return;const {error}=await supabase.from('organization_ai_policies').update({max_provider_cost_per_generation_usd:Number(policy.max_provider_cost_per_generation_usd),max_provider_cost_per_day_usd:Number(policy.max_provider_cost_per_day_usd),max_credits_per_day:Number(policy.max_credits_per_day),max_retries_per_provider:Number(policy.max_retries_per_provider),max_failovers:Number(policy.max_failovers),request_timeout_ms:Number(policy.request_timeout_ms),moderation_mode:policy.moderation_mode,updated_at:new Date().toISOString()}).eq('organization_id',orgId);setMessage(error?error.message:t('settingsSaved'))}
  async function upsertProvider(row:ProviderSetting){const payload={...row,organization_id:orgId,priority:Number(row.priority),updated_at:new Date().toISOString()};delete (payload as any).id;const {error}=await supabase.from('organization_provider_settings').upsert(payload,{onConflict:'organization_id,kind,quality_tier,provider_code,model_code'});setMessage(error?error.message:t('settingsSaved'));await load()}
  function addProvider(){setProviders(x=>[...x,{kind:'text',quality_tier:'quality',provider_code:'custom',model_code:'model',env_prefix:'TEXT_QUALITY_PRIMARY',priority:100,enabled:false,is_fallback:false}])}
  async function testProvider(row:ProviderSetting){const tok=await token();if(!tok)return;setMessage('');const r=await fetch('/api/admin/providers/test',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${tok}`},body:JSON.stringify({kind:row.kind,quality:row.quality_tier})});const data=await r.json().catch(()=>({}));setMessage(r.ok?`${t('providerTestSuccess')} · ${data.provider||row.provider_code} · ${data.latencyMs??'?'}ms`:`${t('providerTestFailed')}: ${data.error||r.status}`)}
  const canAdmin=role==='owner'||role==='admin';
  if(loading)return <main className="p-10 text-center text-zinc-400">{t('loading')}</main>;
  return <AppShell>
  <section className="settings-head">
    <div><div className="studio-eyebrow">WORKSPACE CONTROL</div><h1>{t('settingsTitle')}</h1><p>{t('settingsSubtitle')}</p></div>
    <div className="settings-role"><span>{ar?'دورك':'Your role'}</span><strong>{role}</strong></div>
  </section>
  {message&&<div className="settings-message">{message}</div>}

  <div className="settings-grid">
    <section className="settings-card">
      <div className="settings-card-head"><div className="settings-icon"><Users size={18}/></div><div><h2>{t('teamTitle')}</h2><p>{t('teamSubtitle')}</p></div></div>
      {canAdmin&&<div className="invite-row"><input className="input" type="email" placeholder={t('email')} value={email} onChange={e=>setEmail(e.target.value)}/><select className="input" value={inviteRole} onChange={e=>setInviteRole(e.target.value)}><option value="admin">Admin</option><option value="editor">Editor</option><option value="viewer">Viewer</option></select><button className="settings-primary" onClick={invite} disabled={!email}>{t('sendInvite')}</button></div>}
      {inviteUrl&&<div className="invite-link-box"><b>{t('inviteLink')}</b><span>{inviteUrl}</span></div>}
      <div className="member-list">{members.map(m=><div key={m.user_id} className="member-row"><div><span>{ar?'عضو':'Member'}</span><b>{m.user_id.slice(0,12)}…</b></div><div className="member-actions"><span className="role-pill">{m.role}</span>{canAdmin&&m.role!=='owner'&&<><select className="input" value={m.role} onChange={e=>changeMember(m.user_id,e.target.value)}><option value="admin">Admin</option><option value="editor">Editor</option><option value="viewer">Viewer</option></select><button onClick={()=>removeMember(m.user_id)}>{t('remove')}</button></>}</div></div>)}</div>
      {invites.filter(i=>i.status==='pending').length>0&&<div className="pending-invites"><h3>{t('pendingInvites')}</h3>{invites.filter(i=>i.status==='pending').map(i=><div key={i.id}><span>{i.email} · {i.role}</span>{canAdmin&&<button onClick={()=>revoke(i.id)}>{t('revoke')}</button>}</div>)}</div>}
    </section>

    <section className="settings-card billing-card">
      <div className="settings-card-head"><div className="settings-icon"><CreditCard size={18}/></div><div><h2>{t('billingTitle')}</h2><p>{ar?'الخطة الحالية وحدود الاستخدام':'Current plan and usage allowance'}</p></div></div>
      <div className="plan-card"><span>{t('currentPlan')}</span><h3>{locale==='ar'?plan?.name_ar:plan?.name_en}</h3><div><div><small>{t('monthlyCredits')}</small><b>{plan?.monthly_credits??0}</b></div><div><small>{t('includedSeats')}</small><b>{plan?.included_seats??1}</b></div></div><footer>{t('subscriptionStatus')}: <strong>{subscription?.status||'—'}</strong></footer></div>
      <div className="billing-note">{t('billingNotConnected')}</div>
    </section>

    <section className="settings-card settings-wide">
      <div className="settings-card-head"><div className="settings-icon"><Shield size={18}/></div><div><h2>{t('aiPolicyTitle')}</h2><p>{t('aiPolicySubtitle')}</p></div></div>
      {policy&&<div className="policy-grid">
        <Field label={t('perGenerationBudget')} value={policy.max_provider_cost_per_generation_usd} onChange={v=>setPolicy({...policy,max_provider_cost_per_generation_usd:v})}/>
        <Field label={t('dailyBudget')} value={policy.max_provider_cost_per_day_usd} onChange={v=>setPolicy({...policy,max_provider_cost_per_day_usd:v})}/>
        <Field label={t('dailyCreditCap')} value={policy.max_credits_per_day} onChange={v=>setPolicy({...policy,max_credits_per_day:v})}/>
        <Field label={t('timeoutMs')} value={policy.request_timeout_ms} onChange={v=>setPolicy({...policy,request_timeout_ms:v})}/>
        <Field label={t('retries')} value={policy.max_retries_per_provider} onChange={v=>setPolicy({...policy,max_retries_per_provider:v})}/>
        <Field label={t('failovers')} value={policy.max_failovers} onChange={v=>setPolicy({...policy,max_failovers:v})}/>
        <label className="settings-field"><span>{t('moderationMode')}</span><select className="input" value={policy.moderation_mode} onChange={e=>setPolicy({...policy,moderation_mode:e.target.value})}><option value="enforce">enforce</option><option value="warn">warn</option><option value="off">off</option></select></label>
        <div className="policy-save"><button className="settings-primary" disabled={!canAdmin} onClick={savePolicy}>{t('saveSettings')}</button></div>
      </div>}
    </section>

    <section className="settings-card settings-wide">
      <div className="settings-card-head settings-card-head-actions"><div className="flex items-center gap-3"><div className="settings-icon"><Bot size={18}/></div><div><h2>{t('providersTitle')}</h2><p>{t('providersSubtitle')}</p></div></div>{canAdmin&&<button className="secondary-action" onClick={addProvider}>+ {t('addProvider')}</button>}</div>
      <div className="providers-table-wrap"><table className="providers-table"><thead><tr><th>{ar?'النوع':'Kind'}</th><th>{ar?'المستوى':'Tier'}</th><th>{ar?'المزود':'Provider'}</th><th>{ar?'الموديل':'Model'}</th><th>ENV prefix</th><th>{ar?'الأولوية':'Priority'}</th><th>{ar?'مفعّل':'Enabled'}</th><th></th></tr></thead><tbody>{providers.map((p,i)=><tr key={p.id||`new-${i}`}><td><select className="input" value={p.kind} onChange={e=>setProviders(x=>x.map((v,j)=>j===i?{...v,kind:e.target.value}:v))}><option>text</option><option>image</option><option>audio</option><option>video</option></select></td><td><select className="input" value={p.quality_tier} onChange={e=>setProviders(x=>x.map((v,j)=>j===i?{...v,quality_tier:e.target.value}:v))}><option>fast</option><option>quality</option><option>ultra</option></select></td>{['provider_code','model_code','env_prefix'].map(k=><td key={k}><input className="input" value={(p as any)[k]} onChange={e=>setProviders(x=>x.map((v,j)=>j===i?{...v,[k]:e.target.value}:v))}/></td>)}<td><input className="input" type="number" value={p.priority} onChange={e=>setProviders(x=>x.map((v,j)=>j===i?{...v,priority:Number(e.target.value)}:v))}/></td><td className="provider-check"><input type="checkbox" checked={p.enabled} onChange={e=>setProviders(x=>x.map((v,j)=>j===i?{...v,enabled:e.target.checked}:v))}/></td><td><div className="provider-actions"><button onClick={()=>upsertProvider(p)} disabled={!canAdmin}>{t('save')}</button>{p.kind==='text'&&p.enabled&&<button onClick={()=>testProvider(p)} disabled={!canAdmin}>{t('testProvider')}</button>}</div></td></tr>)}</tbody></table>{providers.length===0&&<div className="settings-empty">{t('noProviderSettings')}</div>}</div>
      <div className="provider-secret-note">{t('providerSecretHint')}</div>
    </section>

    <section className="settings-card settings-wide">
      <div className="settings-card-head"><div className="settings-icon"><RefreshCw size={18}/></div><div><h2>{t('readinessTitle')}</h2><p>{t('readinessSubtitle')}</p></div></div>
      <div className="readiness-grid">{(readiness?.checks||[]).map((c:any)=><div key={c.key} className={c.ok?'readiness-item is-ok':'readiness-item'}>{c.ok?<CheckCircle2 size={19}/>:<CircleAlert size={19}/>}<div><b>{c.key.replaceAll('_',' ')}</b><span>{c.ok?t('configured'):t('notConfigured')}</span></div></div>)}</div>
      {readiness&&<div className={readiness.readyForPrivateBeta?'readiness-summary is-ok':'readiness-summary'}>{readiness.readyForPrivateBeta?t('privateBetaReady'):t('privateBetaNotReady')}</div>}
    </section>
  </div>
</AppShell>;
}
function Field({label,value,onChange}:{label:string;value:any;onChange:(v:string)=>void}){return <label className="block"><span className="text-xs font-bold text-zinc-500">{label}</span><input className="input mt-2" value={value??''} onChange={e=>onChange(e.target.value)}/></label>}
