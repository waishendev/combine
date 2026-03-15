import type { Metadata } from "next";
import { Playfair_Display, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Header } from "@/components/layout/Header";
import Marquee from "@/components/home/Marquee";
import AnnouncementModal from "@/components/home/AnnouncementModal";
import { Footer } from "@/components/layout/Footer";
import { WhatsappButton } from "@/components/layout/WhatsappButton";
import CursorTrail from "@/components/visual/CursorTrail";
import { getBookingHomepage } from "@/lib/serverHomepage";

const heading = Playfair_Display({ subsets: ["latin"], variable: "--font-heading" });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });

export async function generateMetadata(): Promise<Metadata> {
  const homepage = await getBookingHomepage();
  const title = homepage?.seo?.meta_title || process.env.NEXT_PUBLIC_APP_NAME || "GentleGurls Booking";
  const description = homepage?.seo?.meta_description || "Premium salon booking experience for GentleGurls.";

  return {
    title,
    description,
    keywords: homepage?.seo?.meta_keywords?.split(",").map((item) => item.trim()).filter(Boolean),
    openGraph: {
      title,
      description,
      type: "website",
      ...(homepage?.seo?.meta_og_image
        ? {
            images: [
              {
                url: homepage.seo.meta_og_image,
              },
            ],
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(homepage?.seo?.meta_og_image ? { images: [homepage.seo.meta_og_image] } : {}),
    },
    ...(homepage?.shop_favicon_url
      ? {
          icons: {
            icon: homepage.shop_favicon_url,
          },
        }
      : {}),
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const homepage = await getBookingHomepage();
  
  // Prioritize NEXT_PUBLIC_COLOR to avoid system env variable override
  // System env variables can override .env.local, but NEXT_PUBLIC_* vars are handled differently
  const colorMode = process.env.NEXT_PUBLIC_COLOR ?? "1";
  const theme = colorMode === "2" ? "cream" : "soft";

  return (
    <html lang="en" data-theme={theme}>
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
              {homepage?.shop_logo_url && (
          <link rel="preload" href={homepage.shop_logo_url} as="image" fetchPriority="high" />
        )}
      </head>
      <body data-theme={theme} className={`${heading.variable} ${body.variable} antialiased`}>
        <Providers>
          <CursorTrail />
          {homepage?.marquees && homepage.marquees.length > 0 && <Marquee items={homepage.marquees} />}
          <Header logoUrl={homepage?.shop_logo_url ?? null} />
          {homepage?.announcements && homepage.announcements.length > 0 && (
            <AnnouncementModal items={homepage.announcements} />
          )}
          <main className="min-h-[70vh] bg-[var(--background-soft)]/70">{children}</main>
          <Footer footer={homepage?.settings?.footer} />
          <WhatsappButton
            enabled={homepage?.contact?.whatsapp?.enabled}
            phone={homepage?.contact?.whatsapp?.phone}
            defaultMessage={homepage?.contact?.whatsapp?.default_message}
          />
        </Providers>
      </body>
    </html>
  );
}
