import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { I18nProvider } from '@/lib/i18n';
import { buildMetadataIcons } from '@/lib/pwaIcons';
import { getCrmBranding } from '@/lib/serverCrmBranding';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getCrmBranding();

  return {
    title: 'Gentlegurls Management App',
    description: 'Ecommerce administration dashboard',
    manifest: '/manifest.webmanifest',
    icons: buildMetadataIcons(branding?.crm_favicon_icons, branding?.crm_favicon_url ?? '/images/logo.png'),
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}  overflow-hidden antialiased`}>
        <I18nProvider>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
