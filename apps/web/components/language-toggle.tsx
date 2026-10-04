'use client';
import { Languages } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

export function LanguageToggle() {
  const { t, toggle } = useLanguage();
  return <button type="button" onClick={toggle} className="btn btn-ghost inline-flex items-center gap-2" aria-label="Switch language"><Languages size={16}/><span>{t('language')}</span></button>;
}
