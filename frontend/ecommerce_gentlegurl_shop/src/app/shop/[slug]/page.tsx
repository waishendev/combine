import { ShopBrowser } from "@/components/shop/ShopBrowser";

type CategoryPageProps = {
  params: { slug: string };
};

export default function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = params;

  return <ShopBrowser menuSlug={slug} />;
}
