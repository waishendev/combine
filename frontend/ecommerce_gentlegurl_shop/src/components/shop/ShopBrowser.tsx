"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ProductGrid from "@/components/products/ProductGrid";

const SORT_OPTIONS = [
  { value: "latest", label: "Latest" },
  { value: "price_asc", label: "Price low to high" },
  { value: "price_desc", label: "Price high to low" },
];

const PER_PAGE = 12;

type Product = {
  id: number | string;
  name: string;
  price: number | string;
  slug?: string;
  images?: Array<{ image_path?: string }>;
  is_in_wishlist?: boolean;
};

type Category = {
  id: number | string;
  slug: string;
  name?: string;
  label?: string;
};

type ProductsMeta = {
  currentPage: number;
  lastPage: number;
  total: number;
};

type ShopBrowserProps = {
  initialCategorySlug?: string;
};

export function ShopBrowser({ initialCategorySlug }: ShopBrowserProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [meta, setMeta] = useState<ProductsMeta>({
    currentPage: 1,
    lastPage: 1,
    total: 0,
  });
  const [selectedCategory, setSelectedCategory] = useState<string | "all">(
    initialCategorySlug ?? "all",
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sort, setSort] = useState<string>(SORT_OPTIONS[0]?.value ?? "latest");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 350);

    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [selectedCategory, debouncedSearch, sort]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/proxy/public/shop/categories", {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`Failed to load categories (${res.status})`);
      }

      const json = await res.json();
      const rawCategories: Category[] = (json.data ?? json) as Category[];

      setCategories(rawCategories);
    } catch (err) {
      console.error("[ShopBrowser] Categories error", err);
      setCategories([]);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("per_page", PER_PAGE.toString());

      if (selectedCategory !== "all") {
        params.set("category_slug", selectedCategory);
      }

      if (debouncedSearch) {
        params.set("search", debouncedSearch);
      }

      if (sort) {
        params.set("sort", sort);
      }

      const res = await fetch(
        `/api/proxy/public/shop/products?${params.toString()}`,
        {
          cache: "no-store",
        },
      );

      if (!res.ok) {
        throw new Error(`Failed to load products (${res.status})`);
      }

      const json = await res.json();
      const payload = json.data ?? json;
      const items: Product[] = Array.isArray(payload)
        ? payload
        : payload.data ?? payload.items ?? [];

      const metaPayload = payload.meta ?? json.meta ?? {};
      const resolvedMeta: ProductsMeta = {
        currentPage: metaPayload.current_page ?? metaPayload.currentPage ?? page,
        lastPage: metaPayload.last_page ?? metaPayload.lastPage ?? page,
        total: metaPayload.total ?? items.length,
      };

      setProducts(items);
      setMeta(resolvedMeta);
    } catch (err) {
      console.error("[ShopBrowser] Products error", err);
      setError("We couldn't load the products right now. Please try again soon.");
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedSearch, page, selectedCategory, sort]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const activeCategoryLabel = useMemo(() => {
    if (selectedCategory === "all") return "All";
    const active = categories.find((cat) => cat.slug === selectedCategory);
    return active?.name || active?.label || "Category";
  }, [categories, selectedCategory]);

  const showEmptyState = !isLoading && products.length === 0;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[#ec4899]">Shop</p>
          <h1 className="text-2xl font-semibold text-gray-900">Thoughtfully curated finds</h1>
        </div>
        <div className="text-sm text-gray-500">
          {activeCategoryLabel === "All"
            ? "Browse everything"
            : `Browsing ${activeCategoryLabel}`}
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-[220px_1fr]">
        <aside className="rounded-2xl border border-pink-50 bg-white/80 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900">Categories</h2>
            <span className="rounded-full bg-pink-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#ec4899]">
              {categories.length || "All"}
            </span>
          </div>

          <div className="mt-3 md:hidden">
            <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="category-mobile">
              Select category
            </label>
            <select
              id="category-mobile"
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              className="w-full rounded-xl border border-pink-100 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#ec4899] focus:ring-2 focus:ring-pink-100"
            >
              <option value="all">All</option>
              {categories.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.name || category.label || category.slug}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 hidden flex-col gap-2 md:flex">
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className={`w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                selectedCategory === "all"
                  ? "bg-gradient-to-r from-pink-50 to-white text-[#ec4899] shadow-sm"
                  : "text-gray-700 hover:bg-pink-50"
              }`}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category.slug}
                type="button"
                onClick={() => setSelectedCategory(category.slug)}
                className={`w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                  selectedCategory === category.slug
                    ? "bg-gradient-to-r from-pink-50 to-white text-[#ec4899] shadow-sm"
                    : "text-gray-700 hover:bg-pink-50"
                }`}
              >
                {category.name || category.label || category.slug}
              </button>
            ))}
          </div>
        </aside>

        <section className="space-y-6">
          <div className="rounded-2xl border border-pink-50 bg-white/80 p-4 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="relative w-full md:max-w-sm">
                <input
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search for products"
                  className="w-full rounded-xl border border-pink-100 bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-[#ec4899] focus:ring-2 focus:ring-pink-100"
                  aria-label="Search products"
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs uppercase tracking-[0.15em] text-[#ec4899]">
                  Search
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
                  Sort
                </span>
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                  className="rounded-xl border border-pink-100 bg-white px-3 py-2 text-sm font-medium text-gray-800 outline-none transition focus:border-[#ec4899] focus:ring-2 focus:ring-pink-100"
                  aria-label="Sort products"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-pink-50 bg-white/80 p-4 shadow-sm">
            {isLoading ? (
              <div className="flex h-40 items-center justify-center text-sm text-gray-600">
                Loading products...
              </div>
            ) : error ? (
              <div className="rounded-xl bg-pink-50 px-4 py-3 text-sm text-[#be185d]">
                {error}
              </div>
            ) : showEmptyState ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-sm text-gray-600">
                <p className="font-semibold text-gray-800">No products found</p>
                <p className="max-w-md text-xs text-gray-500">
                  Try adjusting your search, switching categories, or exploring another sort option.
                </p>
              </div>
            ) : (
              <ProductGrid items={products} />
            )}
          </div>

          <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-pink-50 bg-white/80 p-4 text-sm text-gray-700 shadow-sm md:flex-row">
            <div className="text-xs uppercase tracking-[0.2em] text-gray-500">
              Page {meta.currentPage} of {meta.lastPage}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={meta.currentPage <= 1 || isLoading}
                className="rounded-xl border border-pink-100 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition disabled:cursor-not-allowed disabled:opacity-50 hover:border-[#ec4899] hover:text-[#ec4899]"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() =>
                  setPage((current) =>
                    meta.lastPage ? Math.min(meta.lastPage, current + 1) : current + 1,
                  )
                }
                disabled={(meta.lastPage && meta.currentPage >= meta.lastPage) || isLoading}
                className="rounded-xl border border-pink-100 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition disabled:cursor-not-allowed disabled:opacity-50 hover:border-[#ec4899] hover:text-[#ec4899]"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
