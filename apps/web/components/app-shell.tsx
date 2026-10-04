'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BarChart3,
  BrainCircuit,
  ChevronLeft,
  FolderOpen,
  Home,
  LogOut,
  PanelLeftClose,
  Settings2,
  Sparkles,
  WandSparkles,
  Zap,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase';
import { LanguageToggle } from '@/components/language-toggle';
import { WorkspaceSwitcher } from '@/components/workspace-switcher';
import { useLanguage } from '@/lib/i18n';

type Props = {
  children: React.ReactNode;
  brandName?: string | null;
  credits?: number;
};

export function AppShell({ children, brandName, credits = 0 }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [collapsed, setCollapsed] = useState(false);
  const { locale } = useLanguage();
  const ar = locale === 'ar';

  const nav = [
    { href: '/dashboard', label: ar ? 'الرئيسية' : 'Home', icon: Home },
    { href: '/creative', label: ar ? 'الاستوديو' : 'Studio', icon: WandSparkles },
    { href: '/projects', label: ar ? 'المشاريع' : 'Projects', icon: FolderOpen },
    { href: '/brand', label: 'Brand Brain', icon: BrainCircuit },
    { href: '/usage', label: ar ? 'الاستخدام' : 'Usage', icon: BarChart3 },
    { href: '/settings', label: ar ? 'الإعدادات' : 'Settings', icon: Settings2 },
  ];

  return (
    <div className="studio-shell">
      <aside className={collapsed ? 'studio-sidebar is-collapsed' : 'studio-sidebar'}>
        <div className="studio-brand">
          <div className="studio-brand-mark"><Sparkles size={18} /></div>
          {!collapsed && (
            <div>
              <div className="studio-brand-name">Creative OS</div>
              <div className="studio-brand-sub">{brandName || 'AI Studio'}</div>
            </div>
          )}
        </div>

        <nav className="studio-nav">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
            return (
              <Link key={href} href={href} className={active ? 'studio-nav-item is-active' : 'studio-nav-item'}>
                <Icon size={18} />
                {!collapsed && <span>{label}</span>}
                {!collapsed && active && <ChevronLeft size={15} className="nav-chevron ms-auto opacity-60" />}
              </Link>
            );
          })}
        </nav>

        <div className="studio-sidebar-bottom">
          {!collapsed && (
            <div className="credit-chip">
              <span><Zap size={15} /> Credits</span>
              <strong>{credits.toLocaleString(locale === 'ar' ? 'ar-EG' : 'en-US')}</strong>
            </div>
          )}
          <button className="studio-nav-item w-full" onClick={async () => { await supabase.auth.signOut(); router.push('/auth'); }}>
            <LogOut size={18} />
            {!collapsed && <span>{ar ? 'تسجيل الخروج' : 'Sign out'}</span>}
          </button>
          <button className="studio-collapse" onClick={() => setCollapsed((v) => !v)} aria-label={ar ? 'طي القائمة الجانبية' : 'Toggle sidebar'}>
            <PanelLeftClose size={17} className={collapsed ? 'rotate-180' : ''} />
          </button>
        </div>
      </aside>

      <div className="studio-main">
        <header className="studio-topbar">
          <div className="min-w-0">
            <div className="studio-eyebrow">AI CREATIVE OPERATING SYSTEM</div>
            <div className="truncate text-sm text-zinc-400">{brandName || (ar ? 'مساحة العمل' : 'Workspace')}</div>
          </div>
          <div className="flex items-center gap-2">
            <WorkspaceSwitcher />
            <LanguageToggle />
          </div>
        </header>
        <div className="studio-content">{children}</div>
      </div>
    </div>
  );
}
