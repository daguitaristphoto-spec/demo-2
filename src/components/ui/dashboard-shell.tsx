import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

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

const navLinkBaseStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  minWidth: 180,
  padding: '14px 18px',
  borderRadius: 16,
  border: '1px solid rgba(255, 255, 255, 0.14)',
  background: 'rgba(255, 255, 255, 0.04)',
  color: 'white',
  textDecoration: 'none',
  transition: 'all 0.2s ease',
};

const navLinkActiveStyle: CSSProperties = {
  background: 'linear-gradient(135deg, rgba(255, 196, 92, 0.95), rgba(255, 216, 132, 0.9))',
  color: '#1f2937',
  border: '1px solid rgba(255, 208, 122, 0.9)',
  boxShadow: '0 10px 28px rgba(255, 196, 92, 0.22)',
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
    <div
      style={{
        minHeight: '100vh',
      }}
    >
      <div
        style={{
          maxWidth: 1500,
          margin: '0 auto',
          padding: 24,
        }}
      >
        <header className="page-header-card" style={{ marginBottom: 24 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 20,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="brand-badge">Speak Up DNU 2026</div>

              <div>
                <h1
                  style={{
                    margin: 0,
                    fontSize: 36,
                    lineHeight: 1.15,
                  }}
                >
                  Own The Mic
                </h1>
                <p
                  style={{
                    margin: '8px 0 0',
                    opacity: 0.85,
                  }}
                >
                  Hệ thống chấm điểm trực tuyến.
                </p>
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  flexWrap: 'wrap',
                  marginTop: 4,
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '8px 14px',
                    borderRadius: 999,
                    background: 'rgba(255,255,255,0.08)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    fontWeight: 700,
                  }}
                >
                  {roleLabel}
                </span>

                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '8px 14px',
                    borderRadius: 999,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.12)',
                  }}
                >
                  {userName}
                </span>
              </div>
            </div>

            {actions ? (
              <div
                className="header-actions"
                style={{
                  display: 'flex',
                  gap: 12,
                  flexWrap: 'wrap',
                  justifyContent: 'flex-end',
                }}
              >
                {actions}
              </div>
            ) : null}
          </div>

          <nav
            style={{
              display: 'flex',
              gap: 14,
              flexWrap: 'wrap',
              marginTop: 24,
            }}
          >
            {navItems.map((item) => {
              const active = activeHref === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={active ? { ...navLinkBaseStyle, ...navLinkActiveStyle } : navLinkBaseStyle}
                >
                  <span
                    style={{
                      fontSize: 17,
                      fontWeight: 700,
                      lineHeight: 1.2,
                    }}
                  >
                    {item.label}
                  </span>

                  {item.description ? (
                    <span
                      style={{
                        fontSize: 13,
                        lineHeight: 1.45,
                        opacity: active ? 0.85 : 0.8,
                      }}
                    >
                      {item.description}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </header>

        <main className="shell-main" style={{ width: '100%' }}>
          <section className="page-header-card" style={{ marginBottom: 24 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <div>
                <div className="eyebrow">{roleLabel}</div>
                <h2 className="page-title">{title}</h2>
                {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
              </div>
            </div>
          </section>

          {children}
        </main>
      </div>
    </div>
  );
}
