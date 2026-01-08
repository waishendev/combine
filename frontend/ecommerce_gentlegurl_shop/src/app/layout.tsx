import type { Metadata } from "next";
import "./globals.css";

import Marquee from "@/components/home/Marquee";
import ShopHeader from "@/components/layout/ShopHeader";
import WhatsappButton from "@/components/home/WhatsappButton";
import CursorTrail from "@/components/visual/CursorTrail";
import { ShopProviders } from "@/components/providers/ShopProviders";
import { ShopFooter } from "@/components/layout/ShopFooter";
import { headers } from "next/headers";
import { getHomepage } from "@/lib/server/getHomepage";
import { getUser } from "@/lib/server/getUser";
import { cache } from "react";
import { mapSeoToMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

const getHomepageCached = cache(getHomepage);

export async function generateMetadata(): Promise<Metadata> {
  const homepage = await getHomepageCached();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const baseMetadata = mapSeoToMetadata(homepage?.seo, {
    meta_title: "Gentlegurls",
  });

  const resolvedTitle =
    typeof baseMetadata.title === "string" && baseMetadata.title.trim().length > 0
      ? baseMetadata.title
      : "Gentlegurls";
  const description = baseMetadata.description;

  return {
    ...baseMetadata,
    title: resolvedTitle,
    alternates: {
      canonical: siteUrl,
    },
    openGraph: {
      ...(baseMetadata.openGraph ?? {}),
      title: resolvedTitle,
      description,
      url: siteUrl,
      type: "website",
    },
    twitter: {
      ...(baseMetadata.twitter ?? {}),
      title: resolvedTitle,
      description,
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Prioritize NEXT_PUBLIC_COLOR to avoid system env variable override
  // System env variables can override .env.local, but NEXT_PUBLIC_* vars are handled differently
  const colorMode = process.env.NEXT_PUBLIC_COLOR ?? "1";
  const theme = colorMode === "2" ? "cream" : "soft";
  
  // Debug: Log theme selection (remove in production)
  if (process.env.NODE_ENV === "development") {
    console.log("[Theme Debug] COLOR env:", process.env.COLOR);
    console.log("[Theme Debug] NEXT_PUBLIC_COLOR env:", process.env.NEXT_PUBLIC_COLOR);
    console.log("[Theme Debug] colorMode:", colorMode);
    console.log("[Theme Debug] selected theme:", theme);
  }
  const headerList = await headers();
  const pathname = headerList.get("x-pathname") ?? "";
  const isAuthRoute = pathname === "/login" || pathname === "/register";
  const initialCustomer = isAuthRoute ? null : await getUser();
  const homepage = await getHomepageCached();

  return (
    <html lang="en" data-theme={theme}>
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      </head>
      <body data-theme={theme}>
        <CursorTrail />
        <ShopProviders
          initialCustomer={initialCustomer}
          shippingSetting={homepage?.settings?.shipping}
        >
          {homepage?.marquees && homepage.marquees.length > 0 && (
            <Marquee items={homepage.marquees} />
          )}
          <ShopHeader />
          <main className="min-h-[70vh] bg-[var(--background-soft)]/70">{children}</main>
          <ShopFooter footer={homepage?.settings?.footer} />
          <WhatsappButton
            enabled={homepage?.contact?.whatsapp?.enabled}
            phone={homepage?.contact?.whatsapp?.phone}
            defaultMessage={homepage?.contact?.whatsapp?.default_message}
          />
        </ShopProviders>
      </body>
    </html>
  );
}
