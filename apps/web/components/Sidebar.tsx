'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Dashboard', icon: '◈' },
  { href: '/services', label: 'Services', icon: '⬢' },
  { href: '/incidents', label: 'Incidents', icon: '⚠' },
  { href: '/logs', label: 'Logs', icon: '☰' },
  { href: '/runbooks', label: 'Runbooks', icon: '✎' },
  { href: '/analytics', label: 'Analytics', icon: '◫' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
];

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="sidebar" aria-label="Primary">
      <div className="brand">SENTINEL <span>AI</span><br /><small style={{ fontWeight: 400, fontSize: 11, color: '#8fa1bd' }}>Incident Intelligence</small></div>
      <nav className="nav">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={path === l.href ? 'active' : ''} aria-current={path === l.href ? 'page' : undefined}>
            <span aria-hidden>{l.icon}</span> <span className="label" style={{ marginLeft: 8 }}>{l.label}</span>
          </Link>
        ))}
      </nav>
    </aside>
  );
}
