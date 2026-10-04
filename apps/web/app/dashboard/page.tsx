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

  const tools: Tool[] = [
    { title: 'إنشاء إعلان فيديو', subtitle: 'من الفكرة إلى السكريبت والمشاهد والفيديو', icon: Film, prompt: 'اعمل لي إعلان فيديو احترافي', tag: 'الأكثر استخدامًا', featured: true },
    { title: 'تصميم إعلان', subtitle: 'كرياتيف ثابت بهوية البراند', icon: ImageIcon, prompt: 'اعمل لي تصميم إعلان سوشيال ميديا', tag: 'Images' },
    { title: 'كتابة إعلان', subtitle: 'Hooks وPrimary Text وCTA', icon: MessageSquareText, prompt: 'اكتب لي 3 نسخ إعلانية مختلفة', tag: 'Copy' },
    { title: 'تعليق صوتي', subtitle: 'Voiceover عربي أو إنجليزي', icon: Mic2, prompt: 'جهز لي تعليق صوتي للإعلان', tag: 'Voice' },
    { title: 'حملة كاملة', subtitle: 'Brief + Variants + Storyboard + Assets', icon: Layers3, prompt: 'ابنِ لي حملة إعلانية كاملة', tag: 'Campaign' },
  ];

  function launch(value?: string) {
    const finalPrompt = (value ?? prompt).trim();
    if (!finalPrompt) return;
    sessionStorage.setItem('creative-prompt', finalPrompt);
    router.push('/creative');
  }

  if (loading) return <main className="studio-loading"><Sparkles className="animate-pulse"/><span>جاري تجهيز الاستوديو...</span></main>;

  return (
    <AppShell brandName={brand?.name} credits={wallet}>
      <section className="studio-hero">
        <div>
          <div className="studio-eyebrow">CREATIVE STUDIO</div>
          <h1>إيه اللي عايز تصنعه النهارده؟</h1>
          <p>ابدأ بهدفك، وسيستخدم Creative OS بيانات البراند لبناء أفضل Workflow تلقائيًا.</p>
        </div>
        <button className="new-project-btn" onClick={() => router.push('/creative')}><Plus size={17}/> مشروع جديد</button>
      </section>

      <section className="prompt-stage">
        <div className="prompt-glow" />
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="مثال: اعمل إعلان Reels لعرض Recovery يستهدف الناس اللي بتتمرن جيم، Tone سريع وقوي..."
        />
        <div className="prompt-stage-footer">
          <div className="prompt-hints"><span><Zap size={14}/> Brand Brain متصل</span><span>Quality: Balanced</span></div>
          <button onClick={() => launch()} disabled={!prompt.trim()}><Sparkles size={17}/> ابدأ الإنشاء <ArrowLeft size={16}/></button>
        </div>
      </section>

      <section className="studio-section">
        <div className="studio-section-head">
          <div><span className="studio-eyebrow">QUICK START</span><h2>ابدأ بأداة</h2></div>
          <button onClick={() => router.push('/projects')}>عرض كل المشاريع <ArrowLeft size={15}/></button>
        </div>

        <div className="studio-tools-grid">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <button key={tool.title} onClick={() => launch(tool.prompt)} className={tool.featured ? 'studio-tool-card is-featured' : 'studio-tool-card'}>
                <div className="studio-tool-top"><div className="studio-tool-icon"><Icon size={22}/></div><span>{tool.tag}</span></div>
                <div className="mt-auto"><h3>{tool.title}</h3><p>{tool.subtitle}</p></div>
                <div className="studio-tool-action">ابدأ الآن <ArrowLeft size={15}/></div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="insight-strip">
        <div className="insight-icon"><WandSparkles size={20}/></div>
        <div><span>اقتراح ذكي</span><strong>جرّب 3 زوايا إعلانية مختلفة قبل إنتاج الفيديو النهائي.</strong></div>
        <button onClick={() => launch('اعمل لي 3 زوايا إعلانية مختلفة للحملة')}>جرّب الآن</button>
      </section>
    </AppShell>
  );
}
