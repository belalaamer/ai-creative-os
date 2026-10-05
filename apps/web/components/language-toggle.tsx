'use client';
import { Languages } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

export function LanguageToggle() {
  const { t, toggle, locale } = useLanguage();
  const ar = locale === 'ar';
  return <button type="button" onClick={toggle} className="btn btn-ghost inline-flex items-center gap-2" aria-label={ar?'تغيير اللغة إلى الإنجليزية':'Switch language to Arabic'}><Languages size={16}/><span>{t('language')}</span></button>;
}
