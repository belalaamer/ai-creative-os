'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  BadgeCheck,
  BrainCircuit,
  ChevronLeft,
  Film,
  Image as ImageIcon,
  Layers3,
  Mic2,
  Play,
  Sparkles,
  WandSparkles,
} from 'lucide-react';
import { LanguageToggle } from '@/components/language-toggle';
import { useLanguage } from '@/lib/i18n';

export default function Home() {
  const { locale } = useLanguage();
  const ar = locale === 'ar';

  const copy = ar ? {
    navTools: 'الأدوات',
    navHow: 'كيف يعمل',
    signIn: 'تسجيل الدخول',
    start: 'ابدأ مجانًا',
    badge: 'استوديو إبداعي كامل بالذكاء الاصطناعي',
    title1: 'من فكرة بسيطة',
    title2: 'إلى إعلان جاهز للنشر.',
    body: 'اكتب المطلوب مرة واحدة. المنصة تفهم البراند، تبني الزاوية الإعلانية، السكريبت، الصور، الصوت والفيديو داخل Workflow واحد.',
    primary: 'أنشئ أول إعلان',
    secondary: 'شاهد كيف يعمل',
    social: 'Brand Brain + Creative Strategy + Production',
    sectionBadge: 'TOOLS',
    sectionTitle: 'كل أدوات صناعة المحتوى في مكان واحد',
    sectionBody: 'ابدأ بالأداة التي تحتاجها الآن، وسيستخدم النظام هوية البراند وسياقه تلقائيًا.',
    workflowTitle: 'مش Prompt وخلاص. ده نظام إنتاج كامل.',
    workflowBody: 'كل مشروع يمر من استراتيجية واضحة إلى نسخ إعلانية ومشاهد وأصول مرئية ثم نسخة نهائية قابلة للتطوير.',
  } : {
    navTools: 'Tools', navHow: 'How it works', signIn: 'Sign in', start: 'Start free',
    badge: 'A complete AI creative studio',
    title1: 'From one simple idea',
    title2: 'to a publish-ready ad.',
    body: 'Describe the outcome once. The platform understands your brand, builds the angle, script, visuals, voice and video in one workflow.',
    primary: 'Create your first ad', secondary: 'See how it works',
    social: 'Brand Brain + Creative Strategy + Production',
    sectionBadge: 'TOOLS', sectionTitle: 'Every creative tool in one workspace',
    sectionBody: 'Start with the tool you need. Your brand context is applied automatically.',
    workflowTitle: 'More than a prompt box. A complete production system.',
    workflowBody: 'Every project moves from strategy to variants, scenes, assets and a final production-ready output.',
  };

  const tools = [
    { icon: Film, title: ar ? 'إعلان فيديو' : 'Video Ad', desc: ar ? 'سكريبت، Storyboard، مشاهد وفيديو كامل.' : 'Script, storyboard, scenes and final video.', accent: 'violet' },
    { icon: ImageIcon, title: ar ? 'تصميم إعلان' : 'Ad Design', desc: ar ? 'كرياتيف ثابت ومتوافق مع هوية البراند.' : 'On-brand static creative and social visuals.', accent: 'blue' },
    { icon: WandSparkles, title: ar ? 'نسخ إعلانية' : 'Ad Copy', desc: ar ? 'Hooks وPrimary Text وCTA وزوايا متعددة.' : 'Hooks, primary text, CTAs and angles.', accent: 'amber' },
    { icon: Mic2, title: ar ? 'تعليق صوتي' : 'Voiceover', desc: ar ? 'صوت عربي أو إنجليزي متصل بالمشهد.' : 'Arabic or English voice tied to each scene.', accent: 'rose' },
  ];

  return (
    <main className="marketing-page">
      <nav className="marketing-nav">
        <Link href="/" className="brand-lockup">
          <span className="brand-logo"><Sparkles size={18} /></span>
          <span>Creative OS</span>
        </Link>
        <div className="hidden items-center gap-7 text-sm text-zinc-400 md:flex">
          <a href="#tools" className="hover:text-white">{copy.navTools}</a>
          <a href="#workflow" className="hover:text-white">{copy.navHow}</a>
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <Link href="/auth" className="marketing-login">{copy.signIn}</Link>
          <Link href="/auth" className="marketing-cta">{copy.start}<ArrowLeft size={15} /></Link>
        </div>
      </nav>

      <section className="hero-grid">
        <div className="hero-copy">
          <div className="hero-badge"><BadgeCheck size={15} /> {copy.badge}</div>
          <h1><span>{copy.title1}</span><strong>{copy.title2}</strong></h1>
          <p>{copy.body}</p>
          <div className="hero-actions">
            <Link href="/auth" className="marketing-cta is-large">{copy.primary}<ArrowLeft size={18} /></Link>
            <a href="#workflow" className="marketing-secondary"><Play size={16} />{copy.secondary}</a>
          </div>
          <div className="hero-proof"><BrainCircuit size={16} />{copy.social}</div>
        </div>

        <div className="hero-product">
          <div className="product-window">
            <div className="product-window-top">
              <div className="flex gap-1.5"><i /><i /><i /></div>
              <span>Creative Studio</span>
              <span className="live-dot">LIVE</span>
            </div>
            <div className="product-window-body">
              <aside className="product-mini-sidebar">
                <div className="mini-logo"><Sparkles size={16}/></div>
                {[WandSparkles, Film, ImageIcon, Layers3].map((Icon, i) => <div key={i} className={i === 0 ? 'mini-nav active' : 'mini-nav'}><Icon size={16}/></div>)}
              </aside>
              <div className="product-canvas">
                <div className="canvas-label">{ar ? 'ماذا تريد أن تصنع؟' : 'What do you want to create?'}</div>
                <div className="prompt-demo">
                  <span>{ar ? 'اعمل إعلان Reels لعرض Recovery موجه للناس اللي بتتمرن...' : 'Create a Reels ad for a recovery offer targeting gym-goers...'}</span>
                  <button><Sparkles size={15}/></button>
                </div>
                <div className="preview-grid">
                  <div className="preview-card preview-primary">
                    <div className="preview-noise" />
                    <div className="preview-copy"><small>01 / HOOK</small><strong>{ar ? 'ارجع أقوى.' : 'Come back stronger.'}</strong><span>{ar ? 'حملة فيديو · 20 ثانية' : 'Video campaign · 20 sec'}</span></div>
                  </div>
                  <div className="preview-stack">
                    <div><span>A</span><b>{ar ? 'زاوية الأداء' : 'Performance angle'}</b></div>
                    <div><span>B</span><b>{ar ? 'زاوية الألم' : 'Pain angle'}</b></div>
                    <div><span>C</span><b>{ar ? 'زاوية النتيجة' : 'Outcome angle'}</b></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="floating-card one"><Sparkles size={15}/><span>{ar ? 'Brand-aware' : 'Brand-aware'}</span></div>
          <div className="floating-card two"><Film size={15}/><span>{ar ? 'جاهز للإنتاج' : 'Production ready'}</span></div>
        </div>
      </section>

      <section id="tools" className="marketing-section">
        <div className="section-heading">
          <div className="studio-eyebrow">{copy.sectionBadge}</div>
          <h2>{copy.sectionTitle}</h2>
          <p>{copy.sectionBody}</p>
        </div>
        <div className="tool-showcase">
          {tools.map(({ icon: Icon, title, desc, accent }) => (
            <Link href="/auth" key={title} className={`marketing-tool accent-${accent}`}>
              <div className="tool-icon"><Icon size={22}/></div>
              <div><h3>{title}</h3><p>{desc}</p></div>
              <ChevronLeft size={18} className="tool-arrow"/>
            </Link>
          ))}
        </div>
      </section>

      <section id="workflow" className="workflow-band">
        <div className="workflow-copy"><span className="studio-eyebrow">WORKFLOW</span><h2>{copy.workflowTitle}</h2><p>{copy.workflowBody}</p></div>
        <div className="workflow-steps">
          {['Brand Brain', 'Creative Brief', 'A/B/C Variants', 'Storyboard', 'Production'].map((x, i) => (
            <div key={x} className="workflow-step"><span>0{i + 1}</span><b>{x}</b></div>
          ))}
        </div>
      </section>
    </main>
  );
}
