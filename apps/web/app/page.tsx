'use client';
import Link from 'next/link';
import { Sparkles, Video, Image as ImageIcon, Mic2, FileText, Globe2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { LanguageToggle } from '@/components/language-toggle';

export default function Home() {
  const { t } = useLanguage();
  const tools = [
    [Video, t('videoAd'), t('videoAdDesc')],
    [ImageIcon, t('socialDesign'), t('socialDesignDesc')],
    [FileText, t('adCopy'), t('adCopyDesc')],
    [Mic2, t('voiceOver'), t('voiceOverDesc')],
    [Globe2, t('landingPage'), t('landingPageDesc')],
  ];
  return <main className="min-h-screen px-6 py-10"><div className="mx-auto max-w-6xl">
    <nav className="flex items-center justify-between gap-3"><div className="flex items-center gap-3 font-extrabold text-xl"><Sparkles size={22}/> AI Creative OS</div><div className="flex items-center gap-2"><LanguageToggle/><Link className="btn btn-ghost" href="/auth">{t('signIn')}</Link></div></nav>
    <section className="py-24 text-center"><span className="inline-flex rounded-full border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-sm text-violet-200">{t('heroBadge')}</span><h1 className="mx-auto mt-6 max-w-4xl text-5xl font-black leading-tight md:text-7xl">{t('heroTitle')}</h1><p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-zinc-400">{t('heroBody')}</p><div className="mt-9 flex justify-center gap-3"><Link href="/auth" className="btn btn-primary">{t('startNow')}</Link><a href="#tools" className="btn btn-ghost">{t('seeTools')}</a></div></section>
    <section id="tools" className="grid gap-4 md:grid-cols-5">{tools.map(([Icon,title,desc])=>{const I=Icon as typeof Video;return <div key={String(title)} className="card p-5 text-start"><I className="mb-5 text-violet-300"/><div className="font-bold">{String(title)}</div><div className="mt-2 text-sm leading-6 text-zinc-500">{String(desc)}</div></div>})}</section>
  </div></main>;
}
