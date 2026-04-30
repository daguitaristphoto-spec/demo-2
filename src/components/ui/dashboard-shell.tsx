import Link from 'next/link';
import type { ReactNode } from 'react';

type NavItem = {
  href: string;
  label: string;
  description?: string;
};

type DashboardShellProps = {
  roleLabel: string;
  userName: string;
  title: string;
  subtitle?: string;
  navItems: NavItem[];
  activeHref: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function DashboardShell({
  roleLabel,
  userName,
  title,
  subtitle,
  navItems,
  activeHref,
  actions,
  children,
}: DashboardShellProps) {
  return (
    <div className="shell-layout">
      <aside className="shell-sidebar">
        <div className="brand-card">
          <div className="brand-badge">Speak Up DNU 2026</div>
          <h1>Own The Mic</h1>
          <p>Hệ thống chấm điểm trực tuyến.</p>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-label">Vai trò hiện tại</div>
          <div className="sidebar-user-card">
            <div className="sidebar-role">{roleLabel}</div>
            <div className="sidebar-user-name">{userName}</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-label">Điều hướng</div>
          {navItems.map((item) => {
            const active = activeHref === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${active ? 'nav-link-active' : ''}`}
              >
                <span className="nav-link-title">{item.label}</span>

                {item.description ? (
                  <span className="nav-link-description">
                    {item.description}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="shell-main">
        <header className="page-header-card">
          <div>
            <div className="eyebrow">{roleLabel}</div>
            <h2 className="page-title">{title}</h2>
            {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
          </div>

          {actions ? <div className="header-actions">{actions}</div> : null}
        </header>

        {children}
      </main>
    </div>
  );
}
