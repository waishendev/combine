import { Suspense } from "react";

import { ShopBrowser } from "@/components/shop/ShopBrowser";

export default function ShopIndexPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <ShopBrowser />
    </Suspense>
  );
}
