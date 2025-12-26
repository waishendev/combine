"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import ProductGrid from "@/components/products/ProductGrid";
import { getOrCreateSessionToken } from "@/lib/sessionToken";

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
  sold_count?: number | string;
};

type ShopMenuCategory = {
  id: number | string;
  slug: string;
  name: string;
};

type ShopMenu = {
  id: number | string;
  title: string;
  slug: string;
  categories: ShopMenuCategory[];
};

type ProductsMeta = {
  currentPage: number;
  lastPage: number;
  total: number;
};

type ShopBrowserProps = {
  menuSlug?: string;
};

export function ShopBrowser({ menuSlug }: ShopBrowserProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [menus, setMenus] = useState<ShopMenu[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [meta, setMeta] = useState<ProductsMeta>({
    currentPage: Number(searchParams?.get("page")) || 1,
    lastPage: 1,
    total: 0,
  });
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    () => searchParams?.get("category") ?? null,
  );
  const [searchTerm, setSearchTerm] = useState<string>(
    () => searchParams?.get("q") ?? "",
  );
  const [debouncedSearch, setDebouncedSearch] = useState<string>(
    () => searchParams?.get("q") ?? "",
  );
  const [sort, setSort] = useState<string>(
    () => searchParams?.get("sort") ?? SORT_OPTIONS[0].value,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuNotFound, setMenuNotFound] = useState(false);
  const [page, setPage] = useState<number>(
    () => Number(searchParams?.get("page")) || 1,
  );
  const [minPriceInput, setMinPriceInput] = useState<string>(
    () => searchParams?.get("min_price") ?? "",
  );
  const [maxPriceInput, setMaxPriceInput] = useState<string>(
    () => searchParams?.get("max_price") ?? "",
  );
  const [appliedMinPrice, setAppliedMinPrice] = useState<string>(
    () => searchParams?.get("min_price") ?? "",
  );
  const [appliedMaxPrice, setAppliedMaxPrice] = useState<string>(
    () => searchParams?.get("max_price") ?? "",
  );

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 400);

    return () => clearTimeout(handler);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [selectedCategory, debouncedSearch, sort, appliedMinPrice, appliedMaxPrice]);

  useEffect(() => {
    const params = new URLSearchParams();

    if (debouncedSearch) params.set("q", debouncedSearch);
    if (sort && sort !== SORT_OPTIONS[0].value) params.set("sort", sort);
    if (selectedCategory) params.set("category", selectedCategory);
    if (appliedMinPrice) params.set("min_price", appliedMinPrice);
    if (appliedMaxPrice) params.set("max_price", appliedMaxPrice);
    if (page > 1) params.set("page", page.toString());

    const queryString = params.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    });
  }, [debouncedSearch, sort, selectedCategory, appliedMinPrice, appliedMaxPrice, page, pathname, router]);

  const fetchMenus = useCallback(async () => {
    try {
      const res = await fetch("/api/proxy/public/shop/menu", {
        cache: "no-store",
      });

      if (!res.ok) {
        throw new Error(`Failed to load menu (${res.status})`);
      }

      const json = await res.json();
      const rawMenus: ShopMenu[] = (json.data ?? json) as ShopMenu[];
      setMenus(rawMenus ?? []);

      if (menuSlug) {
        setMenuNotFound(!rawMenus.some((menu) => menu.slug === menuSlug));
      }
    } catch (err) {
      console.error("[ShopBrowser] Menu error", err);
      setMenus([]);
    }
  }, [menuSlug]);

  const fetchProducts = useCallback(async () => {
    if (menuSlug && menuNotFound) {
      setProducts([]);
      setMeta({ currentPage: 1, lastPage: 1, total: 0 });
      setError("Menu not found.");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("per_page", PER_PAGE.toString());

      if (menuSlug) {
        params.set("menu_slug", menuSlug);
      }

      if (selectedCategory) {
        params.set("category_slug", selectedCategory);
      }

      if (debouncedSearch) {
        params.set("q", debouncedSearch);
      }

      if (sort) {
        params.set("sort", sort);
      }

      if (appliedMinPrice) {
        params.set("min_price", appliedMinPrice);
      }

      if (appliedMaxPrice) {
        params.set("max_price", appliedMaxPrice);
      }

      // Add session_token from cookie for wishlist support
      const sessionToken = getOrCreateSessionToken();
      if (sessionToken) {
        params.set("session_token", sessionToken);
      }

      console.log("[ShopBrowser] products params:", params.toString());
      
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

      const metaPayload = json.meta ?? payload.meta ?? {};
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
  }, [appliedMaxPrice, appliedMinPrice, debouncedSearch, menuNotFound, menuSlug, page, selectedCategory, sort]);

  useEffect(() => {
    fetchMenus();
  }, [fetchMenus]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const sidebarMenus = useMemo(() => {
    if (menuSlug) {
      const menu = menus.find((item) => item.slug === menuSlug);
      return menu ? [menu] : [];
    }

    return menus;
  }, [menuSlug, menus]);

  const currentMenu = useMemo(() => {
    if (menuSlug) {
      return menus.find((menu) => menu.slug === menuSlug) ?? null;
    }

    return null;
  }, [menuSlug, menus]);

  const findCategoryLabel = useCallback(
    (slug: string | null) => {
      if (!slug) return null;
      const fromMenu = menus
        .flatMap((menu) => menu.categories.map((category) => ({
          menuSlug: menu.slug,
          name: category.name,
          slug: category.slug,
        })))
        .find((category) => category.slug === slug);

      return fromMenu?.name ?? slug;
    },
    [menus],
  );

  const activeCategoryLabel = useMemo(() => {
    if (selectedCategory) return findCategoryLabel(selectedCategory);

    if (menuSlug) {
      return currentMenu?.title ?? "Menu";
    }

    return "All Products";
  }, [currentMenu?.title, findCategoryLabel, menuSlug, selectedCategory]);

  const showEmptyState = !isLoading && products.length === 0;
  const isMenuScoped = Boolean(menuSlug);
  const allLabel = menuSlug ? "All" : "All Products";
  const menuTitleLabel = menuSlug ? currentMenu?.title ?? "Menu" : "Shop";
  const headerLabel = menuSlug ? `Shop / ${menuTitleLabel}` : "Shop";

  const handleApplyPrice = () => {
    setAppliedMinPrice(minPriceInput.trim());
    setAppliedMaxPrice(maxPriceInput.trim());
  };

  const handleClearPrice = () => {
    setMinPriceInput("");
    setMaxPriceInput("");
    setAppliedMinPrice("");
    setAppliedMaxPrice("");
  };

  const handleSelectAll = () => {
    setSelectedCategory(null);
  };

  const mobileCategoryValue = selectedCategory
    ? `${menuSlug ?? ""}::${selectedCategory}`
    : "all";

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      {menuSlug && menuNotFound ? (
        <div className="rounded-2xl border border-[var(--muted)]/60 bg-white/80 p-6 text-center shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent-strong)]">Shop</p>
          <h1 className="mt-2 text-2xl font-semibold text-gray-900">Menu not found</h1>
          <p className="mt-2 text-sm text-gray-600">The menu you are looking for does not exist or is unavailable.</p>
        </div>
      ) : (
        <>
          <header className="mb-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent-strong)]">{headerLabel}</p>
              <h1 className="text-2xl font-semibold text-gray-900">Thoughtfully curated finds</h1>
            </div>
          </header>

          <div className="grid gap-6 md:grid-cols-[260px_1fr]">
            <aside className="rounded-2xl border border-[var(--muted)]/60 bg-white/80 p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-gray-900">Categories</h2>
                <span className="rounded-full bg-[var(--background-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--accent-strong)]">
                  {sidebarMenus.reduce((count, menu) => count + menu.categories.length, 0) || "All"}
                </span>
              </div>

              <div className="mt-3 md:hidden">
                <label className="mb-1 block text-xs font-medium text-gray-600" htmlFor="category-mobile">
                  Select category
                </label>
                <select
                  id="category-mobile"
                  value={mobileCategoryValue}
                  onChange={(event) => {
                    const value = event.target.value;

                    if (value === "all") {
                      handleSelectAll();
                      return;
                    }

                    const [, categorySlug] = value.split("::");
                    setSelectedCategory(categorySlug ?? null);
                  }}
                  className="w-full rounded-xl border border-[var(--muted)] bg-white px-3 py-2 text-sm outline-none transition focus:border-[var(--accent-strong)] focus:ring-2 focus:ring-[var(--muted)]"
                >
                  <option value="all">{allLabel}</option>
                  {sidebarMenus.map((menu) =>
                    menuSlug ? (
                      menu.categories.map((category) => (
                        <option key={category.slug} value={`${menu.slug}::${category.slug}`}>
                          {category.name}
                        </option>
                      ))
                    ) : (
                      <optgroup key={menu.slug} label={menu.title}>
                        {menu.categories.map((category) => (
                          <option key={category.slug} value={`${menu.slug}::${category.slug}`}>
                            {category.name}
                          </option>
                        ))}
                      </optgroup>
                    ),
                  )}
                </select>
              </div>

              <div className="mt-4 hidden flex-col gap-4 md:flex">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className={`w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                    selectedCategory === null
                      ? "bg-gradient-to-r from-[var(--background-soft)] to-white text-[var(--accent-strong)] shadow-sm"
                      : "text-gray-700 hover:bg-[var(--background-soft)]"
                  }`}
                >
                  {allLabel}
                </button>

                {sidebarMenus.map((menu) => (
                  <div key={menu.slug} className="space-y-2">
                    {!menuSlug && (
                      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-gray-500">
                        {menu.title}
                      </p>
                    )}
                    <div className="flex flex-col gap-2">
                      {menu.categories.map((category) => {
                        const isActive = selectedCategory === category.slug;
                        return (
                          <button
                            key={category.slug}
                            type="button"
                            onClick={() => {
                              setSelectedCategory(category.slug);
                            }}
                            className={`w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                              isActive
                                ? "bg-gradient-to-r from-[var(--background-soft)] to-white text-[var(--accent-strong)] shadow-sm"
                                : "text-gray-700 hover:bg-[var(--background-soft)]"
                            }`}
                          >
                            {category.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </aside>

            <section className="space-y-6">
              <div className="rounded-2xl border border-[var(--muted)]/60 bg-white/80 p-4 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="relative w-full md:max-w-sm">
                    <input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search for products"
                      className="w-full rounded-xl border border-[var(--muted)] bg-white px-4 py-2.5 text-sm text-gray-900 outline-none transition focus:border-[var(--accent-strong)] focus:ring-2 focus:ring-[var(--muted)]"
                      aria-label="Search products"
                    />
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs uppercase tracking-[0.15em] text-[var(--accent-strong)]">
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
                      className="rounded-xl border border-[var(--muted)] bg-white px-3 py-2 text-sm font-medium text-gray-800 outline-none transition focus:border-[var(--accent-strong)] focus:ring-2 focus:ring-[var(--muted)]"
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

              <div className="rounded-2xl border border-[var(--muted)]/60 bg-white/80 p-4 shadow-sm">
                {isLoading ? (
                  <div className="flex h-40 items-center justify-center text-sm text-gray-600">
                    Loading products...
                  </div>
                ) : error ? (
                  <div className="rounded-xl bg-[var(--background-soft)] px-4 py-3 text-sm text-[var(--accent-stronger)]">{error}</div>
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

              <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-[var(--muted)]/60 bg-white/80 p-4 text-sm text-gray-700 shadow-sm md:flex-row">
                <div className="text-xs uppercase tracking-[0.2em] text-gray-500">
                  Page {meta.currentPage} of {meta.lastPage}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={meta.currentPage <= 1 || isLoading}
                    className="rounded-xl border border-[var(--muted)] bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition disabled:cursor-not-allowed disabled:opacity-50 hover:border-[var(--accent-strong)] hover:text-[var(--accent-strong)]"
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
                    className="rounded-xl border border-[var(--muted)] bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition disabled:cursor-not-allowed disabled:opacity-50 hover:border-[var(--accent-strong)] hover:text-[var(--accent-strong)]"
                  >
                    Next
                  </button>
                </div>
              </div>
            </section>
          </div>
        </>
      )}
    </main>
  );
}
