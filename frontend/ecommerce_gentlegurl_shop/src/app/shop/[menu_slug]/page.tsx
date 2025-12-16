import { ShopBrowser } from "@/components/shop/ShopBrowser";

export const dynamic = "force-dynamic";

type CategoryPageProps = {
  params: { menu_slug: string };
};

export default function CategoryPage({ params }: CategoryPageProps) {
  const { menu_slug } = params;

  return <ShopBrowser menuSlug={menu_slug} />;
}
