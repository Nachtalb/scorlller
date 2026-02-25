import type { Metadata } from 'next';
import './globals.css';
import Providers from './providers';
import PwaInstallPrompt from '@/components/PwaInstallPrompt';
import ServiceWorkerRegistrar from '@/components/ServiceWorkerRegistrar';

export const metadata: Metadata = {
  title: 'Scrolller',
  description: 'TikTok-style Reddit media viewer',
  icons: { icon: '/favicon.ico' },
  manifest: '/manifest.json',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-950 text-white overflow-hidden">
        <Providers>{children}</Providers>
        <ServiceWorkerRegistrar />
        <PwaInstallPrompt />
      </body>
    </html>
  );
}