import { ShopBrowser } from "@/components/shop/ShopBrowser";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;

  return <ShopBrowser initialCategorySlug={slug} />;
}
