import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';

export const metadata: Metadata = { title: 'Sentinel AI — Incident Intelligence', description: 'Monitor services, triage incidents, and investigate root causes with AI.' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#content">Skip to content</a>
        <AuthProvider>
          <div className="app">
            <Sidebar />
            <div className="main">
              <div className="demo-banner" role="note">Demonstration environment — seeded demo data is labelled “demo” and is not live production telemetry.</div>
              <Topbar />
              <main id="content" className="content">{children}</main>
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
