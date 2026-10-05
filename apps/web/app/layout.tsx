import './globals.css';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { LanguageProvider, type Locale } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'AI Creative OS',
  description: 'Bilingual AI creative operating system',
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const saved = cookieStore.get('ai-creative-os-locale')?.value;
  const locale: Locale = saved === 'en' ? 'en' : 'ar';
  const dir = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body>
        <LanguageProvider initialLocale={locale}>{children}</LanguageProvider>
      </body>
    </html>
  );
}
