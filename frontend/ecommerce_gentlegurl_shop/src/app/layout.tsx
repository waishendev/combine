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

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gentlegurl Shop",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const colorMode = process.env.COLOR ?? process.env.NEXT_PUBLIC_COLOR ?? "1";
  const theme = colorMode === "2" ? "cream" : "soft";
  const headerList = await headers();
  const pathname = headerList.get("x-pathname") ?? "";
  const isAuthRoute = pathname === "/login" || pathname === "/register";
  const initialCustomer = isAuthRoute ? null : await getUser();
  const homepage = await getHomepage();

  return (
    <html lang="en" data-theme={theme}>
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
