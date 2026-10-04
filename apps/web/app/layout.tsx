import './globals.css';
import type { Metadata } from 'next';
import { LanguageProvider } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'AI Creative OS',
  description: 'Bilingual AI creative operating system',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ar" dir="rtl" suppressHydrationWarning><body><LanguageProvider>{children}</LanguageProvider></body></html>;
}
