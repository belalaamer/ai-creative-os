'use client';
import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';
import { useLanguage } from '@/lib/i18n';
import { AppShell } from '@/components/app-shell';
import { Coins, FileAudio, FileImage, FileVideo, Sparkles, WandSparkles, Clock3 } from 'lucide-react';

type Generation={id:string;kind:string;status:string;provider_code:string|null;model_code:string|null;credits_charged:number;created_at:string;response:any};
type Asset={id:string;generation_id:string;asset_type:string;storage_path:string;mime_type:string|null;metadata:any;signedUrl?:string};

export default function ProjectDetailPage(){
  const params=useParams<{id:string}>(); const router=useRouter(); const supabase=useMemo(()=>createClient(),[]); const {t,locale}=useLanguage(); const ar=locale==='ar';
  const [project,setProject]=useState<any>(null); const [variants,setVariants]=useState<any[]>([]); const [generations,setGenerations]=useState<Generation[]>([]); const [assets,setAssets]=useState<Asset[]>([]); const [jobs,setJobs]=useState<any[]>([]); const [loading,setLoading]=useState(true);

  useEffect(()=>{(async()=>{
    const {data:{user}}=await supabase.auth.getUser();if(!user){router.replace('/auth');return;}
    const {data:p,error:pErr}=await supabase.from('projects').select('*').eq('id',params.id).single();if(pErr||!p){router.replace('/projects');return;}
    const [{data:g},{data:j},{data:v}]=await Promise.all([
      supabase.from('generations').select('id,kind,status,provider_code,model_code,credits_charged,created_at,response').eq('project_id',params.id).order('created_at',{ascending:false}),
      supabase.from('media_jobs').select('id,kind,scene_no,status,provider_code,model_code,created_at,output').eq('project_id',params.id).order('created_at',{ascending:false}),
      supabase.from('campaign_variants').select('variant_key,title,angle,hook,headline,cta,rationale').eq('project_id',params.id).order('variant_key',{ascending:true})
    ]);
    const gens=(g??[]) as Generation[]; let assetRows:Asset[]=[];
    if(gens.length){
      const {data:a}=await supabase.from('generation_assets').select('*').in('generation_id',gens.map(x=>x.id)).order('created_at',{ascending:false});
      assetRows=(a??[]) as Asset[];
      assetRows=await Promise.all(assetRows.map(async a=>{const {data}=await supabase.storage.from('generation-assets').createSignedUrl(a.storage_path,60*60);return {...a,signedUrl:data?.signedUrl};}));
    }
    setProject(p);setVariants(v??[]);setGenerations(gens);setAssets(assetRows);setJobs(j??[]);setLoading(false);
  })()},[params.id,router,supabase]);

  const totalCredits=generations.reduce((n,g)=>n+Number(g.credits_charged||0),0);
  const icon=(mime:string|null,type:string)=>mime?.startsWith('image/')?<FileImage size={18}/>:mime?.startsWith('audio/')?<FileAudio size={18}/>:mime?.startsWith('video/')?<FileVideo size={18}/>:type.includes('video')?<FileVideo size={18}/>:<Sparkles size={18}/>;

  return <AppShell credits={Math.max(0,totalCredits)}>
    {loading?<div className="text-zinc-500">{t('loading')}</div>:project&&<>
      <section className="project-detail-head">
        <div>
          <div className="studio-eyebrow">PROJECT</div>
          <h1>{project.name}</h1>
          <p>{project.brief?.request||t('projectNoBrief')}</p>
        </div>
        <div className="project-stat"><Coins size={18}/><span>{t('creditsUsed')}</span><strong>{totalCredits}</strong></div>
      </section>

      {variants.length>0&&<section className="project-section">
        <div className="creative-section-title"><div><span className="studio-eyebrow">CREATIVE DIRECTIONS</span><h2>{t('variantsTitle')}</h2></div></div>
        <div className="variant-grid">{variants.map(v=><article key={v.variant_key} className="variant-card">
          <div className="variant-card-top"><span>{v.variant_key}</span><small>{v.cta}</small></div>
          <h3>{v.title}</h3><p className="variant-angle">{v.angle}</p><blockquote>{v.hook}</blockquote>
          <div className="variant-meta"><small>{t('headline')}</small><b>{v.headline}</b></div>
          <p className="variant-rationale">{v.rationale}</p>
        </article>)}</div>
      </section>}

      <section className="project-section project-detail-grid">
        <div>
          <div className="creative-section-title"><div><span className="studio-eyebrow">ASSETS</span><h2>{t('projectAssets')}</h2></div></div>
          {assets.length===0?<div className="project-empty"><Sparkles size={20}/><span>{t('noAssets')}</span></div>:<div className="project-assets-grid">{assets.map(a=><article key={a.id} className="project-asset-card">
            <div className="project-asset-head">{icon(a.mime_type,a.asset_type)}<span>{a.asset_type}</span></div>
            {a.signedUrl&&a.mime_type?.startsWith('image/')&&<img src={a.signedUrl} alt="asset"/>}
            {a.signedUrl&&a.mime_type?.startsWith('audio/')&&<div className="p-4"><audio controls className="w-full" src={a.signedUrl}/></div>}
            {a.signedUrl&&a.mime_type?.startsWith('video/')&&<video controls playsInline src={a.signedUrl}/>}
          </article>)}</div>}
        </div>

        <aside>
          <div className="creative-section-title"><div><span className="studio-eyebrow">HISTORY</span><h2>{t('generationHistory')}</h2></div></div>
          <div className="generation-timeline">{generations.map(g=><div key={g.id} className="generation-row">
            <div className="generation-dot"/>
            <div className="generation-main">
              <div className="generation-top"><b>{g.kind}</b><span><Clock3 size={12}/>{new Intl.DateTimeFormat(locale==='ar'?'ar-EG':'en-US',{dateStyle:'short',timeStyle:'short'}).format(new Date(g.created_at))}</span></div>
              <div className="generation-meta"><span>{g.status}</span><span>{g.provider_code??'-'}</span><span>{Number(g.credits_charged||0)} {t('credits')}</span></div>
            </div>
          </div>)}
          {generations.length===0&&<div className="project-empty"><Sparkles size={20}/><span>{ar?'لا يوجد سجل توليد بعد':'No generation history yet'}</span></div>}
          {jobs.some(j=>j.status==='processing')&&<div className="processing-note"><WandSparkles size={15}/>{t('processingJobs')}</div>}
          </div>
        </aside>
      </section>
    </>}
  </AppShell>;
}
