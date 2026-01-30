import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { cookies } from 'next/headers';
import './globals.css';
import { I18nProvider } from '@/lib/i18n';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const dynamic = 'force-dynamic';

async function getCrmFavicon(): Promise<string | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!baseUrl) {
      return null;
    }

    const ck = await cookies();
    const cookieHeader = ck
      .getAll()
      .map((c) => `${c.name}=${c.value}`)
      .join('; ');

    const response = await fetch(`${baseUrl}/api/ecommerce/branding`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(cookieHeader && { Cookie: cookieHeader }),
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    return payload?.data?.crm_favicon_url ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const faviconUrl = await getCrmFavicon();

  return {
    title: 'GentleGurls Commerce Admin',
    description: 'Ecommerce administration dashboard',
    ...(faviconUrl
      ? {
          icons: {
            icon: faviconUrl,
          },
        }
      : {}),
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
