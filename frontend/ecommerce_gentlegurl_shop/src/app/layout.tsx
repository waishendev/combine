import type { Metadata } from "next";
import "./globals.css";

import Marquee from "@/components/home/Marquee";
import ShopHeader from "@/components/layout/ShopHeader";
import CursorTrail from "@/components/visual/CursorTrail";
import { ShopProviders } from "@/components/providers/ShopProviders";
import { getHomepage } from "@/lib/server/getHomepage";
import { getUser } from "@/lib/server/getUser";

export const metadata: Metadata = {
  title: "Gentlegurl Shop",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialCustomer = await getUser();
  const homepage = await getHomepage();

  return (
    <html lang="en">
      <body>
        <CursorTrail />
        <ShopProviders
          initialCustomer={initialCustomer}
          shippingSetting={homepage?.settings?.shipping}
        >
          {homepage?.marquees && homepage.marquees.length > 0 && (
            <Marquee items={homepage.marquees} />
          )}
          <ShopHeader />
          <main className="min-h-screen bg-[var(--background-soft)]/70">{children}</main>
        </ShopProviders>
      </body>
    </html>
  );
}
