'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Film,
  Image as ImageIcon,
  Layers3,
  MessageSquareText,
  Mic2,
  Plus,
  Sparkles,
  WandSparkles,
  Zap,
} from 'lucide-react';
import { createClient } from '@/lib/supabase';
import { AppShell } from '@/components/app-shell';
import { useLanguage } from '@/lib/i18n';

type Tool = {
  title: string;
  subtitle: string;
  icon: typeof Film;
  prompt: string;
  tag: string;
  featured?: boolean;
};

export default function DashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { locale } = useLanguage();
  const ar = locale === 'ar';
  const [brand, setBrand] = useState<any>(null);
  const [wallet, setWallet] = useState(0);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/auth'); return; }

      const { data: activeOrg } = await supabase.rpc('get_active_organization');
      if (!activeOrg) { router.replace('/onboarding'); return; }

      const [{ data: b }, { data: w }] = await Promise.all([
        supabase.from('brands').select('*').eq('organization_id', String(activeOrg)).order('created_at', { ascending: true }).limit(1).maybeSingle(),
        supabase.from('credit_wallets').select('balance').eq('organization_id', String(activeOrg)).single(),
      ]);

      if (!b) { router.replace('/onboarding'); return; }
      setBrand(b);
      setWallet(w?.balance ?? 0);
      setLoading(false);
    })();
  }, [router, supabase]);

  const tools: Tool[] = ar ? [
    { title: 'إنشاء إعلان فيديو', subtitle: 'من الفكرة إلى السكريبت والمشاهد والفيديو', icon: Film, prompt: 'اعمل لي إعلان فيديو احترافي', tag: 'الأكثر استخدامًا', featured: true },
    { title: 'تصميم إعلان', subtitle: 'كرياتيف ثابت بهوية البراند', icon: ImageIcon, prompt: 'اعمل لي تصميم إعلان سوشيال ميديا', tag: 'صور' },
    { title: 'كتابة إعلان', subtitle: 'Hooks وPrimary Text وCTA', icon: MessageSquareText, prompt: 'اكتب لي 3 نسخ إعلانية مختلفة', tag: 'نصوص' },
    { title: 'تعليق صوتي', subtitle: 'Voiceover عربي أو إنجليزي', icon: Mic2, prompt: 'جهز لي تعليق صوتي للإعلان', tag: 'صوت' },
    { title: 'حملة كاملة', subtitle: 'Brief + Variants + Storyboard + Assets', icon: Layers3, prompt: 'ابنِ لي حملة إعلانية كاملة', tag: 'حملة' },
  ] : [
    { title: 'Create Video Ad', subtitle: 'From idea to script, scenes and final video', icon: Film, prompt: 'Create a professional video ad for my brand', tag: 'Most used', featured: true },
    { title: 'Create Ad Design', subtitle: 'Static creative built around your brand identity', icon: ImageIcon, prompt: 'Create a social media ad design for my brand', tag: 'Images' },
    { title: 'Write Ad Copy', subtitle: 'Hooks, primary text and CTA variations', icon: MessageSquareText, prompt: 'Write 3 distinct ad copy variations', tag: 'Copy' },
    { title: 'Create Voiceover', subtitle: 'Arabic or English voiceover for your creative', icon: Mic2, prompt: 'Create a voiceover for my ad', tag: 'Voice' },
    { title: 'Build Full Campaign', subtitle: 'Brief + Variants + Storyboard + Assets', icon: Layers3, prompt: 'Build a complete advertising campaign for my brand', tag: 'Campaign' },
  ];

  function launch(value?: string) {
    const finalPrompt = (value ?? prompt).trim();
    if (!finalPrompt) return;
    sessionStorage.setItem('creative-prompt', finalPrompt);
    router.push('/creative');
  }

  if (loading) {
    return <main className="studio-loading"><Sparkles className="animate-pulse"/><span>{ar ? 'جاري تجهيز الاستوديو...' : 'Preparing your studio...'}</span></main>;
  }

  return (
    <AppShell brandName={brand?.name} credits={wallet}>
      <section className="studio-hero">
        <div>
          <div className="studio-eyebrow">CREATIVE STUDIO</div>
          <h1>{ar ? 'إيه اللي عايز تصنعه النهارده؟' : 'What do you want to create today?'}</h1>
          <p>{ar ? 'ابدأ بهدفك، وسيستخدم Creative OS بيانات البراند لبناء أفضل Workflow تلقائيًا.' : 'Start with your goal. Creative OS will use your brand context to build the right workflow automatically.'}</p>
        </div>
        <button className="new-project-btn" onClick={() => router.push('/creative')}><Plus size={17}/> {ar ? 'مشروع جديد' : 'New project'}</button>
      </section>

      <section className="prompt-stage">
        <div className="prompt-glow" />
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={ar ? 'مثال: اعمل إعلان Reels لعرض Recovery يستهدف الناس اللي بتتمرن جيم، Tone سريع وقوي...' : 'Example: Create a fast, punchy Reels ad for a recovery offer targeting gym-goers...'}
        />
        <div className="prompt-stage-footer">
          <div className="prompt-hints">
            <span><Zap size={14}/> {ar ? 'Brand Brain متصل' : 'Brand Brain connected'}</span>
            <span>{ar ? 'الجودة: متوازنة' : 'Quality: Balanced'}</span>
          </div>
          <button onClick={() => launch()} disabled={!prompt.trim()}><Sparkles size={17}/> {ar ? 'ابدأ الإنشاء' : 'Start creating'} <ArrowLeft size={16} className="directional-icon"/></button>
        </div>
      </section>

      <section className="studio-section">
        <div className="studio-section-head">
          <div><span className="studio-eyebrow">QUICK START</span><h2>{ar ? 'ابدأ بأداة' : 'Start with a tool'}</h2></div>
          <button onClick={() => router.push('/projects')}>{ar ? 'عرض كل المشاريع' : 'View all projects'} <ArrowLeft size={15} className="directional-icon"/></button>
        </div>

        <div className="studio-tools-grid">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <button key={tool.title} onClick={() => launch(tool.prompt)} className={tool.featured ? 'studio-tool-card is-featured' : 'studio-tool-card'}>
                <div className="studio-tool-top"><div className="studio-tool-icon"><Icon size={22}/></div><span>{tool.tag}</span></div>
                <div className="mt-auto"><h3>{tool.title}</h3><p>{tool.subtitle}</p></div>
                <div className="studio-tool-action">{ar ? 'ابدأ الآن' : 'Start now'} <ArrowLeft size={15} className="directional-icon"/></div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="insight-strip">
        <div className="insight-icon"><WandSparkles size={20}/></div>
        <div>
          <span>{ar ? 'اقتراح ذكي' : 'Smart suggestion'}</span>
          <strong>{ar ? 'جرّب 3 زوايا إعلانية مختلفة قبل إنتاج الفيديو النهائي.' : 'Test 3 different creative angles before producing the final video.'}</strong>
        </div>
        <button onClick={() => launch(ar ? 'اعمل لي 3 زوايا إعلانية مختلفة للحملة' : 'Create 3 distinct creative angles for this campaign')}>{ar ? 'جرّب الآن' : 'Try it'}</button>
      </section>
    </AppShell>
  );
}
