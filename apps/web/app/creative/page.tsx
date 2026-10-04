'use client';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { useLanguage } from '@/lib/i18n';
import { AppShell } from '@/components/app-shell';
import { ImageIcon, Mic2, Sparkles, Video, WandSparkles, Film, CheckCircle2, Loader2 } from 'lucide-react';

type Brief={objective:string;audience:string;angle:string;offer:string;hooks:string[];concepts:{title:string;idea:string}[];script:string;mode:'provider'|'development'};
type Variant={variantKey:'A'|'B'|'C';title:string;angle:string;hook:string;primaryText:string;headline:string;cta:string;script:string;audience:string;rationale:string};
type Scene={scene:number;durationSeconds:number;shot:string;visualPrompt:string;voiceover:string;onScreenText:string};
type SceneAsset={imageUrl:string;storagePath:string;mode:'provider'|'development';generationId:string};
type VoiceAsset={audioUrl:string;storagePath:string;mode:'provider'|'development';generationId:string};
type VideoAsset={jobId:string;status:'processing'|'succeeded'|'failed';mode:'provider'|'development';videoUrl?:string;storagePath?:string;posterUrl?:string;durationSeconds?:number};
type FinalAsset={jobId?:string;status?:'processing'|'succeeded'|'failed';progress?:number;mode:'provider'|'development';videoUrl?:string;manifestUrl?:string;storagePath?:string};

export default function CreativePage(){
  const supabase=useMemo(()=>createClient(),[]); const {t,locale}=useLanguage();
  const [prompt,setPrompt]=useState(''); const [brief,setBrief]=useState<Brief|null>(null); const [projectId,setProjectId]=useState(''); const [storyboard,setStoryboard]=useState<Scene[]|null>(null);
  const [busy,setBusy]=useState(false); const [storyBusy,setStoryBusy]=useState(false); const [error,setError]=useState(''); const [saved,setSaved]=useState(false);
  const [sceneBusy,setSceneBusy]=useState<Record<number,boolean>>({}); const [assets,setAssets]=useState<Record<number,SceneAsset>>({}); const [allBusy,setAllBusy]=useState(false);
  const [voiceBusy,setVoiceBusy]=useState<Record<number,boolean>>({}); const [voices,setVoices]=useState<Record<number,VoiceAsset>>({});
  const [videoBusy,setVideoBusy]=useState<Record<number,boolean>>({}); const [videos,setVideos]=useState<Record<number,VideoAsset>>({});
  const [variants,setVariants]=useState<Variant[]>([]); const [variantBusy,setVariantBusy]=useState(false); const [selectedVariant,setSelectedVariant]=useState<Variant|null>(null);
  const [assemblyBusy,setAssemblyBusy]=useState(false); const [finalAsset,setFinalAsset]=useState<FinalAsset|null>(null); const [productionBusy,setProductionBusy]=useState(false); const [quality,setQuality]=useState<'fast'|'quality'|'ultra'>('quality');
  useEffect(()=>{setPrompt(sessionStorage.getItem('creative-prompt')??'');},[]);

  function message(error:unknown){const raw=error instanceof Error?error.message:t('genericError');return raw==='insufficient_credits'?t('insufficientCredits'):raw;}
  async function authToken(){const {data:{session}}=await supabase.auth.getSession();if(!session?.access_token)throw new Error('Unauthorized');return session.access_token;}
  async function run(){if(!prompt.trim()){setError(t('emptyPrompt'));return;}setBusy(true);setError('');setSaved(false);try{const token=await authToken();const r=await fetch('/api/creative-brief',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({prompt,locale,quality})});const json=await r.json();if(!r.ok)throw new Error(json.error||'Request failed');setBrief(json.brief);setProjectId(json.projectId);setStoryboard(null);setVariants([]);setSelectedVariant(null);setAssets({});setVoices({});setVideos({});setFinalAsset(null);setSaved(true);}catch(e){setError(message(e));}finally{setBusy(false)}}
  async function generateVariants(){if(!brief||!projectId)return;setVariantBusy(true);setError('');try{const token=await authToken();const r=await fetch('/api/campaign-variants',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({projectId,brief,locale,quality})});const json=await r.json();if(!r.ok)throw new Error(json.error||'Variant generation failed');setVariants(json.variants??[]);setSelectedVariant((json.variants??[])[0]??null);}catch(e){setError(message(e));}finally{setVariantBusy(false)}}
  async function makeStoryboard(){if(!brief||!projectId)return;setStoryBusy(true);setError('');try{const token=await authToken();const r=await fetch('/api/storyboard',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({projectId,brief,variant:selectedVariant,locale,quality})});const json=await r.json();if(!r.ok)throw new Error(json.error||'Request failed');setStoryboard(json.storyboard.scenes);setAssets({});setVoices({});setVideos({});setFinalAsset(null);}catch(e){setError(message(e));}finally{setStoryBusy(false)}}
  async function generateScene(sc:Scene){if(!projectId)return null;setSceneBusy(x=>({...x,[sc.scene]:true}));setError('');try{const token=await authToken();const r=await fetch('/api/generate-image',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({projectId,scene:sc.scene,prompt:sc.visualPrompt,locale,quality})});const json=await r.json();if(!r.ok)throw new Error(json.error||'Image generation failed');setAssets(x=>({...x,[sc.scene]:json}));return json as SceneAsset;}catch(e){setError(message(e));return null;}finally{setSceneBusy(x=>({...x,[sc.scene]:false}))}}
  async function generateVoice(sc:Scene){if(!projectId)return null;setVoiceBusy(x=>({...x,[sc.scene]:true}));setError('');try{const token=await authToken();const r=await fetch('/api/generate-voice',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({projectId,scene:sc.scene,text:sc.voiceover,locale,durationSeconds:sc.durationSeconds,quality})});const json=await r.json();if(!r.ok)throw new Error(json.error||'Voice generation failed');setVoices(x=>({...x,[sc.scene]:json}));return json as VoiceAsset;}catch(e){setError(message(e));return null;}finally{setVoiceBusy(x=>({...x,[sc.scene]:false}))}}
  async function pollVideo(jobId:string,scene:number,tries=0):Promise<VideoAsset|null>{if(tries>60){setError(t('videoTimeout'));return null;}await new Promise(r=>setTimeout(r,4000));const token=await authToken();const res=await fetch(`/api/video-jobs/${jobId}`,{headers:{Authorization:`Bearer ${token}`}});const json=await res.json();if(!res.ok)throw new Error(json.error||'Video status failed');if(json.status==='processing')return pollVideo(jobId,scene,tries+1);if(json.status==='failed')throw new Error(t('videoFailed'));const asset={...json,status:'succeeded'} as VideoAsset;setVideos(x=>({...x,[scene]:asset}));return asset;}
  async function generateVideo(sc:Scene,image?:SceneAsset){const img=image??assets[sc.scene];if(!projectId||!img)return null;setVideoBusy(x=>({...x,[sc.scene]:true}));setError('');try{const token=await authToken();const r=await fetch('/api/video-jobs',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({projectId,scene:sc.scene,prompt:sc.visualPrompt,imageUrl:img.imageUrl,imageStoragePath:img.storagePath,durationSeconds:sc.durationSeconds,locale,quality})});const json=await r.json();if(!r.ok)throw new Error(json.error||'Video generation failed');const initial={...json} as VideoAsset;setVideos(x=>({...x,[sc.scene]:initial}));if(json.status==='processing')return await pollVideo(json.jobId,sc.scene);return initial;}catch(e){setError(message(e));return null;}finally{setVideoBusy(x=>({...x,[sc.scene]:false}))}}
  async function generateAll(){if(!storyboard?.length)return;setAllBusy(true);setError('');try{for(const sc of storyboard){if(!assets[sc.scene])await generateScene(sc);}}finally{setAllBusy(false)}}
  async function produceAll(){if(!storyboard?.length)return;setProductionBusy(true);setError('');try{for(const sc of storyboard){let img=assets[sc.scene];if(!img){const made=await generateScene(sc);if(!made)break;img=made;}if(!voices[sc.scene])await generateVoice(sc);if(!videos[sc.scene])await generateVideo(sc,img);}}finally{setProductionBusy(false)}}
  async function pollAssembly(jobId:string,tries=0):Promise<FinalAsset|null>{if(tries>90){setError(t('videoTimeout'));return null;}await new Promise(r=>setTimeout(r,4000));const token=await authToken();const res=await fetch(`/api/assembly-jobs/${jobId}`,{headers:{Authorization:`Bearer ${token}`}});const json=await res.json();if(!res.ok)throw new Error(json.error||'Assembly status failed');setFinalAsset(json);if(json.status==='processing')return pollAssembly(jobId,tries+1);if(json.status==='failed')throw new Error('Assembly failed');return json as FinalAsset;}
  async function assemble(){if(!storyboard?.length||!projectId)return;setAssemblyBusy(true);setError('');try{const token=await authToken();const scenes=storyboard.map(sc=>({scene:sc.scene,durationSeconds:sc.durationSeconds,onScreenText:sc.onScreenText,image:assets[sc.scene]?{url:assets[sc.scene].imageUrl,storagePath:assets[sc.scene].storagePath}:null,voice:voices[sc.scene]?{url:voices[sc.scene].audioUrl,storagePath:voices[sc.scene].storagePath}:null,video:videos[sc.scene]?{url:videos[sc.scene].videoUrl,storagePath:videos[sc.scene].storagePath,mode:videos[sc.scene].mode,posterUrl:videos[sc.scene].posterUrl}:null}));const r=await fetch('/api/assemble-video',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({projectId,scenes,locale,quality})});const json=await r.json();if(!r.ok)throw new Error(json.error||'Assembly failed');setFinalAsset(json);if(json.status==='processing'&&json.jobId)await pollAssembly(json.jobId);}catch(e){setError(message(e));}finally{setAssemblyBusy(false)}}
  const allProductionReady=!!storyboard?.length&&storyboard.every(sc=>voices[sc.scene]&&videos[sc.scene]?.status==='succeeded');

  const stage = storyboard ? 3 : variants.length ? 2 : brief ? 1 : 0;
  const ar = locale === 'ar';
  const stages = ar
    ? ['الطلب', 'الاستراتيجية', 'النسخ', 'الإنتاج']
    : ['Prompt', 'Strategy', 'Variants', 'Production'];

  return <AppShell>
    <div className="creative-studio-v2">
      <div className="creative-studio-head">
        <div>
          <div className="studio-eyebrow">CREATIVE WORKFLOW</div>
          <h1>{ar ? 'حوّل الفكرة إلى إعلان جاهز.' : 'Turn an idea into a production-ready ad.'}</h1>
          <p>{ar ? 'ابدأ بهدف واحد، وسيب Creative OS يبني الاستراتيجية والنسخ والمشاهد والإنتاج خطوة بخطوة.' : 'Start with one objective and let Creative OS build the strategy, variants, scenes and production step by step.'}</p>
        </div>
        <div className="creative-stage-rail" aria-label={ar ? 'مراحل الإنشاء' : 'Creation stages'}>
          {stages.map((label,i)=><div key={label} className={i<=stage?'creative-stage is-active':'creative-stage'}>
            <span>{String(i+1).padStart(2,'0')}</span><b>{label}</b>
          </div>)}
        </div>
      </div>

      <section className="creative-command">
        <div className="creative-command-label"><Sparkles size={16}/><span>{ar ? 'اكتب النتيجة التي تريدها' : 'Describe the outcome you want'}</span></div>
        <textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder={t('promptPlaceholder')}/>
        <div className="creative-command-footer">
          <div className="creative-quality">
            <span>{t('qualityLabel')}</span>
            <div>{(['fast','quality','ultra'] as const).map(q=><button key={q} type="button" onClick={()=>setQuality(q)} className={quality===q?'is-active':''}>{q==='fast'?t('qualityFast'):q==='ultra'?t('qualityUltra'):t('qualityQuality')}</button>)}</div>
          </div>
          <button onClick={run} disabled={busy||!prompt.trim()} className="creative-run">
            {busy?<Loader2 size={17} className="animate-spin"/>:<Sparkles size={17}/>}
            {busy?t('analyzing'):t('runBrief')}
          </button>
        </div>
      </section>

      {error&&<div className="creative-error">{error}</div>}

      {!brief&&<section className="creative-empty-guide">
        <div className="empty-guide-card"><span>01</span><b>{ar?'اكتب الهدف':'Describe the goal'}</b><p>{ar?'مثلاً: إعلان Reels لعرض Recovery يستهدف عملاء الجيم.':'For example: a Reels ad for a recovery offer targeting gym-goers.'}</p></div>
        <div className="empty-guide-card"><span>02</span><b>{ar?'اختار الجودة':'Choose quality'}</b><p>{ar?'Fast للاختبار، Balanced لمعظم الشغل، وUltra للنسخ المهمة.':'Fast for testing, Balanced for everyday work, Ultra for high-priority output.'}</p></div>
        <div className="empty-guide-card"><span>03</span><b>{ar?'سيب النظام يكمل':'Let the system build'}</b><p>{ar?'هنبني Brief ثم A/B/C ثم Storyboard ثم أصول الإنتاج.':'We will build a brief, A/B/C variants, storyboard and production assets.'}</p></div>
      </section>}

      {brief&&<section className="creative-strategy">
        <div className="creative-section-title">
          <div><span className="studio-eyebrow">01 / STRATEGY</span><h2>{ar?'الاستراتيجية الإعلانية':'Creative strategy'}</h2></div>
          <span className={brief.mode==='provider'?'mode-pill provider':'mode-pill development'}>{brief.mode==='provider'?t('providerMode'):t('developmentMode')}</span>
        </div>

        <div className="strategy-layout">
          <div className="strategy-main">
            <div className="strategy-facts">
              <Field title={t('objective')} value={brief.objective}/>
              <Field title={t('audience')} value={brief.audience}/>
              <Field title={t('angle')} value={brief.angle}/>
              <Field title={t('offer')} value={brief.offer}/>
            </div>
            <div className="strategy-block">
              <div className="strategy-block-head"><span>{t('hooks')}</span><small>{brief.hooks.length}</small></div>
              <div className="hook-list">{brief.hooks.map((x,i)=><div key={i} className="hook-row"><span>{String(i+1).padStart(2,'0')}</span><p>{x}</p></div>)}</div>
            </div>
            <div className="strategy-block">
              <div className="strategy-block-head"><span>{t('concepts')}</span><small>{brief.concepts.length}</small></div>
              <div className="concept-grid">{brief.concepts.map((x,i)=><article key={i}><span>0{i+1}</span><b>{x.title}</b><p>{x.idea}</p></article>)}</div>
            </div>
          </div>

          <aside className="strategy-script">
            <div className="strategy-block-head"><span>{t('script')}</span><small>{ar?'مسودة':'Draft'}</small></div>
            <pre>{brief.script}</pre>
            <div className="strategy-next">
              <span>{ar?'الخطوة التالية':'Next step'}</span>
              <b>{ar?'اختبار 3 زوايا إعلانية مختلفة':'Test three distinct creative angles'}</b>
            </div>
            <button onClick={generateVariants} disabled={variantBusy} className="creative-primary-action">
              {variantBusy?<Loader2 size={16} className="animate-spin"/>:<WandSparkles size={16}/>}
              {variantBusy?t('generatingVariants'):variants.length?t('regenerateVariants'):t('generateVariants')}
            </button>
            {saved&&<div className="save-note"><CheckCircle2 size={14}/>{t('resultSaved')}</div>}
          </aside>
        </div>
      </section>}

      {brief&&<section className="creative-variants">
        <div className="creative-section-title">
          <div><span className="studio-eyebrow">02 / VARIANTS</span><h2>{t('variantsTitle')}</h2><p>{t('variantsSubtitle')}</p></div>
          {variants.length>0&&<button onClick={generateVariants} disabled={variantBusy} className="secondary-action">{variantBusy?t('generatingVariants'):t('regenerateVariants')}</button>}
        </div>

        {variants.length===0?<div className="variants-empty"><span>A</span><span>B</span><span>C</span><p>{ar?'ولّد ثلاث طرق مختلفة لبيع نفس الفكرة، بدل مجرد تغيير الكلمات.':'Generate three genuinely different ways to sell the same idea, not just rewritten copy.'}</p></div>:
        <div className="variant-grid">{variants.map(v=><button key={v.variantKey} type="button" onClick={()=>setSelectedVariant(v)} className={selectedVariant?.variantKey===v.variantKey?'variant-card is-selected':'variant-card'}>
          <div className="variant-card-top"><span>{v.variantKey}</span>{selectedVariant?.variantKey===v.variantKey&&<CheckCircle2 size={18}/>}</div>
          <h3>{v.title}</h3>
          <p className="variant-angle">{v.angle}</p>
          <blockquote>{v.hook}</blockquote>
          <div className="variant-meta"><small>{t('headline')}</small><b>{v.headline}</b></div>
          <p className="variant-rationale">{v.rationale}</p>
        </button>)}</div>}

        {variants.length>0&&<div className="variant-confirm">
          <div><span>{t('selectedVariant')}</span><b>{selectedVariant?.variantKey} — {selectedVariant?.title}</b><p>{t('variantStoryboardHint')}</p></div>
          <button onClick={makeStoryboard} disabled={storyBusy||!selectedVariant} className="creative-primary-action">{storyBusy?<Loader2 size={16} className="animate-spin"/>:<Film size={16}/>} {storyBusy?t('generatingStoryboard'):t('buildSelectedVariant')}</button>
        </div>}
      </section>}

      {storyboard&&<section className="creative-production">
        <div className="creative-section-title">
          <div><span className="studio-eyebrow">03 / PRODUCTION</span><h2>{t('storyboardTitle')}</h2><p>{t('visualStageHint')}</p></div>
          <div className="production-actions"><button onClick={generateAll} disabled={allBusy} className="secondary-action"><WandSparkles size={16}/>{allBusy?t('generatingAllVisuals'):t('generateAllVisuals')}</button><button onClick={produceAll} disabled={productionBusy} className="creative-primary-action"><Film size={16}/>{productionBusy?t('producingAll'):t('produceAll')}</button></div>
        </div>

        <div className="scene-grid">{storyboard.map(sc=><article key={sc.scene} className="scene-card">
          <div className="scene-preview">
            {assets[sc.scene]?<>
              <img src={assets[sc.scene].imageUrl} alt={`${t('scene')} ${sc.scene}`} className={videos[sc.scene]?.mode==='development'?'motion-preview':''}/>
              {videos[sc.scene]?.videoUrl&&<video controls playsInline src={videos[sc.scene].videoUrl}/>}
              {videos[sc.scene]?.status==='processing'&&<div className="scene-processing"><Loader2 className="animate-spin"/><span>{t('videoProcessing')}</span></div>}
            </>:<div className="scene-placeholder"><ImageIcon size={26}/><span>{ar?'لم يتم إنشاء الصورة بعد':'Visual not generated yet'}</span></div>}
            <div className="scene-number">0{sc.scene}</div>
            <div className="scene-duration">{sc.durationSeconds}{t('seconds')}</div>
          </div>
          <div className="scene-body">
            <h3>{sc.shot}</h3>
            <div className="scene-copy"><small>{t('visualPrompt')}</small><p>{sc.visualPrompt}</p></div>
            <div className="scene-copy"><small>{t('voiceover')}</small><p>{sc.voiceover}</p></div>
            {sc.onScreenText&&<div className="scene-onscreen">{sc.onScreenText}</div>}
            <div className="scene-actions">
              <button onClick={()=>generateScene(sc)} disabled={sceneBusy[sc.scene]}><ImageIcon size={15}/>{sceneBusy[sc.scene]?t('generatingVisual'):assets[sc.scene]?t('regenerateVisual'):t('generateVisual')}</button>
              <button onClick={()=>generateVoice(sc)} disabled={voiceBusy[sc.scene]}><Mic2 size={15}/>{voiceBusy[sc.scene]?t('generatingVoice'):voices[sc.scene]?t('regenerateVoice'):t('generateVoice')}</button>
              <button onClick={()=>generateVideo(sc)} disabled={videoBusy[sc.scene]||!assets[sc.scene]}><Video size={15}/>{videoBusy[sc.scene]?t('generatingVideo'):videos[sc.scene]?t('regenerateVideo'):t('generateVideo')}</button>
            </div>
            {voices[sc.scene]&&<div className="scene-audio"><div><span>{t('voiceReady')}</span><b>{voices[sc.scene].mode==='provider'?t('providerMode'):t('developmentMode')}</b></div><audio controls src={voices[sc.scene].audioUrl}/></div>}
          </div>
        </article>)}</div>

        <div className={allProductionReady?'assembly-bar is-ready':'assembly-bar'}>
          <div><span>{allProductionReady?<CheckCircle2 size={18}/>:<Film size={18}/>}</span><div><b>{t('productionReadyTitle')}</b><p>{allProductionReady?t('productionReadyBody'):t('productionPendingBody')}</p></div></div>
          <button onClick={assemble} disabled={!allProductionReady||assemblyBusy} className="creative-primary-action">{assemblyBusy?<Loader2 size={16} className="animate-spin"/>:<Film size={16}/>} {assemblyBusy?t('assemblingVideo'):t('buildVideo')}</button>
        </div>

        {finalAsset&&finalAsset.status==='processing'&&<div className="final-progress"><div><Loader2 className="animate-spin" size={18}/><b>{t('assemblingVideo')}</b><span>{Math.max(4,finalAsset.progress??4)}%</span></div><div><i style={{width:`${Math.max(4,finalAsset.progress??4)}%`}}/></div></div>}
        {finalAsset&&finalAsset.status!=='processing'&&<div className="final-output"><div className="final-output-head"><CheckCircle2 size={19}/><b>{t('finalReady')}</b></div>{finalAsset.videoUrl?<video controls playsInline src={finalAsset.videoUrl}/>:<div className="manifest-output">{t('manifestReady')} {finalAsset.manifestUrl&&<a href={finalAsset.manifestUrl} target="_blank">{t('openManifest')}</a>}</div>}</div>}
      </section>}
    </div>
  </AppShell>;
}
function Field({title,value}:{title:string;value:string}){return <div className="strategy-fact"><span>{title}</span><p>{value}</p></div>}
