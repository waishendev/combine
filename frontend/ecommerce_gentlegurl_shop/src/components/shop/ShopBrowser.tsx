"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  cover_image_url?: string | null;
  images?: Array<{ image_path?: string | null; url?: string | null; sort_order?: number | null }>;
  media?: Array<{ type?: string; url?: string | null; sort_order?: number | null }>;
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

  const page = useMemo(() => Number(searchParams?.get("page")) || 1, [searchParams]);
  const querySearch = searchParams?.get("q") ?? "";
  const querySort = searchParams?.get("sort") ?? SORT_OPTIONS[0].value;
  const queryCategory = searchParams?.get("category") ?? null;
  const queryMinPrice = searchParams?.get("min_price") ?? "";
  const queryMaxPrice = searchParams?.get("max_price") ?? "";

  const [menus, setMenus] = useState<ShopMenu[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [meta, setMeta] = useState<ProductsMeta>({
    currentPage: page,
    lastPage: 1,
    total: 0,
  });
  const [selectedCategory, setSelectedCategory] = useState<string | null>(queryCategory);
  const [searchTerm, setSearchTerm] = useState<string>(querySearch);
  const [debouncedSearch, setDebouncedSearch] = useState<string>(querySearch);
  const [sort, setSort] = useState<string>(querySort);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuNotFound, setMenuNotFound] = useState(false);
  const [minPriceInput, setMinPriceInput] = useState<string>(queryMinPrice);
  const [maxPriceInput, setMaxPriceInput] = useState<string>(queryMaxPrice);
  const [appliedMinPrice, setAppliedMinPrice] = useState<string>(queryMinPrice);
  const [appliedMaxPrice, setAppliedMaxPrice] = useState<string>(queryMaxPrice);
  const requestIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const pushParams = useCallback(
    ({
      nextSearch = debouncedSearch,
      nextSort = sort,
      nextCategory = selectedCategory,
      nextMinPrice = appliedMinPrice,
      nextMaxPrice = appliedMaxPrice,
      nextPage = page,
    }: {
      nextSearch?: string;
      nextSort?: string;
      nextCategory?: string | null;
      nextMinPrice?: string;
      nextMaxPrice?: string;
      nextPage?: number;
    } = {}) => {
      const params = new URLSearchParams();

      if (nextSearch) params.set("q", nextSearch);
      if (nextSort && nextSort !== SORT_OPTIONS[0].value) params.set("sort", nextSort);
      if (nextCategory) params.set("category", nextCategory);
      if (nextMinPrice) params.set("min_price", nextMinPrice);
      if (nextMaxPrice) params.set("max_price", nextMaxPrice);
      if (nextPage > 1) params.set("page", nextPage.toString());

      const queryString = params.toString();
      const nextUrl = queryString ? `${pathname}?${queryString}` : pathname;
      const currentQuery = searchParams?.toString() ?? "";
      const currentUrl = currentQuery ? `${pathname}?${currentQuery}` : pathname;

      if (nextUrl !== currentUrl) {
        router.push(nextUrl, { scroll: false });
      }
    },
    [
      appliedMaxPrice,
      appliedMinPrice,
      debouncedSearch,
      page,
      pathname,
      router,
      searchParams,
      selectedCategory,
      sort,
    ],
  );

  useEffect(() => {
    if (searchTerm !== querySearch) {
      setSearchTerm(querySearch);
    }
    if (debouncedSearch !== querySearch) {
      setDebouncedSearch(querySearch);
    }
    if (sort !== querySort) {
      setSort(querySort);
    }
    if (selectedCategory !== queryCategory) {
      setSelectedCategory(queryCategory);
    }
    if (minPriceInput !== queryMinPrice) {
      setMinPriceInput(queryMinPrice);
    }
    if (maxPriceInput !== queryMaxPrice) {
      setMaxPriceInput(queryMaxPrice);
    }
    if (appliedMinPrice !== queryMinPrice) {
      setAppliedMinPrice(queryMinPrice);
    }
    if (appliedMaxPrice !== queryMaxPrice) {
      setAppliedMaxPrice(queryMaxPrice);
    }
  }, [queryCategory, queryMaxPrice, queryMinPrice, querySearch, querySort]);

  useEffect(() => {
    const handler = setTimeout(() => {
      const nextSearch = searchTerm.trim();
      setDebouncedSearch(nextSearch);

      if (nextSearch !== querySearch) {
        pushParams({ nextSearch, nextPage: 1 });
      }
    }, 400);

    return () => clearTimeout(handler);
  }, [pushParams, querySearch, searchTerm]);

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

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      setIsLoading(true);
      setError(null);
      setProducts([]);

      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("per_page", PER_PAGE.toString());

      if (menuSlug) {
        params.set("menu_slug", menuSlug);
      }

      if (queryCategory) {
        params.set("category_slug", queryCategory);
      }

      if (querySearch) {
        params.set("q", querySearch);
      }

      if (querySort) {
        params.set("sort", querySort);
      }

      if (queryMinPrice) {
        params.set("min_price", queryMinPrice);
      }

      if (queryMaxPrice) {
        params.set("max_price", queryMaxPrice);
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
          signal: abortController.signal,
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

      if (requestIdRef.current === requestId && !abortController.signal.aborted) {
        setProducts(items);
        setMeta(resolvedMeta);
      }
    } catch (err) {
      if (abortController.signal.aborted) {
        return;
      }
      console.error("[ShopBrowser] Products error", err);
      setError("We couldn't load the products right now. Please try again soon.");
      setProducts([]);
    } finally {
      if (requestIdRef.current === requestId && !abortController.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, [
    menuNotFound,
    menuSlug,
    page,
    queryCategory,
    queryMaxPrice,
    queryMinPrice,
    querySearch,
    querySort,
  ]);

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
    const nextMinPrice = minPriceInput.trim();
    const nextMaxPrice = maxPriceInput.trim();
    setAppliedMinPrice(nextMinPrice);
    setAppliedMaxPrice(nextMaxPrice);
    pushParams({ nextMinPrice, nextMaxPrice, nextPage: 1 });
  };

  const handleClearPrice = () => {
    setMinPriceInput("");
    setMaxPriceInput("");
    setAppliedMinPrice("");
    setAppliedMaxPrice("");
    pushParams({ nextMinPrice: "", nextMaxPrice: "", nextPage: 1 });
  };

  const handleSelectAll = () => {
    setSelectedCategory(null);
    pushParams({ nextCategory: null, nextPage: 1 });
  };

  const mobileCategoryValue = selectedCategory
    ? `${menuSlug ?? ""}::${selectedCategory}`
    : "all";

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      {menuSlug && menuNotFound ? (
        <div className="rounded-2xl border border-[var(--card-border)]/60 bg-[var(--card)]/80 p-6 text-center shadow-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent-strong)]">Shop</p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">Menu not found</h1>
          <p className="mt-2 text-sm text-[color:var(--text-muted)]">The menu you are looking for does not exist or is unavailable.</p>
        </div>
      ) : (
        <>
          <header className="mb-6 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent-strong)]">{headerLabel}</p>
              <h1 className="text-2xl font-semibold text-[var(--foreground)]">Thoughtfully curated finds</h1>
            </div>
          </header>

          <div className="grid gap-6 md:grid-cols-[260px_1fr]">
            <aside className="rounded-2xl border border-[var(--card-border)]/60 bg-[var(--card)]/80 p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-[var(--foreground)]">Categories</h2>
                <span className="rounded-full bg-[var(--background-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--accent-strong)]">
                  {sidebarMenus.reduce((count, menu) => count + menu.categories.length, 0) || "All"}
                </span>
              </div>

              <div className="mt-3 md:hidden">
                <label className="mb-1 block text-xs font-medium text-[color:var(--text-muted)]" htmlFor="category-mobile">
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
                    pushParams({ nextCategory: categorySlug ?? null, nextPage: 1 });
                  }}
                  className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm outline-none transition focus:border-[var(--accent-strong)] focus:ring-2 focus:ring-[var(--ring)]/20"
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
                      ? "bg-gradient-to-r from-[var(--background-soft)] to-[var(--card)] text-[var(--accent-strong)] shadow-sm"
                      : "text-[color:var(--text-muted)] hover:bg-[var(--background-soft)]"
                  }`}
                >
                  {allLabel}
                </button>

                {sidebarMenus.map((menu) => (
                  <div key={menu.slug} className="space-y-2">
                    {!menuSlug && (
                      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[color:var(--text-muted)]">
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
                              pushParams({ nextCategory: category.slug, nextPage: 1 });
                            }}
                            className={`w-full rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                              isActive
                                ? "bg-gradient-to-r from-[var(--background-soft)] to-[var(--card)] text-[var(--accent-strong)] shadow-sm"
                                : "text-[color:var(--text-muted)] hover:bg-[var(--background-soft)]"
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
              <div className="rounded-2xl border border-[var(--card-border)]/60 bg-[var(--card)]/80 p-4 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div className="relative w-full md:max-w-sm">
                    <input
                      value={searchTerm}
                      onChange={(event) => setSearchTerm(event.target.value)}
                      placeholder="Search for products"
                      className="w-full rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-4 py-2.5 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--accent-strong)] focus:ring-2 focus:ring-[var(--ring)]/20"
                      aria-label="Search products"
                    />
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs uppercase tracking-[0.15em] text-[var(--accent-strong)]">
                      Search
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--text-muted)]">
                      Sort
                    </span>
                    <select
                      value={sort}
                      onChange={(event) => {
                        const nextSort = event.target.value;
                        setSort(nextSort);
                        pushParams({ nextSort, nextPage: 1 });
                      }}
                      className="rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] px-3 py-2 text-sm font-medium text-[color:var(--text-muted)] outline-none transition focus:border-[var(--accent-strong)] focus:ring-2 focus:ring-[var(--ring)]/20"
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

              <div className="rounded-2xl border border-[var(--card-border)]/60 bg-[var(--card)]/80 p-4 shadow-sm">
                {isLoading ? (
                  <div className="flex h-40 items-center justify-center text-sm text-[color:var(--text-muted)]">
                    Loading products...
                  </div>
                ) : error ? (
                  <div className="rounded-xl bg-[var(--background-soft)] px-4 py-3 text-sm text-[var(--accent-stronger)]">{error}</div>
                ) : showEmptyState ? (
                  <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-sm text-[color:var(--text-muted)]">
                    <p className="font-semibold text-[color:var(--text-muted)]">No products found</p>
                    <p className="max-w-md text-xs text-[color:var(--text-muted)]">
                      Try adjusting your search, switching categories, or exploring another sort option.
                    </p>
                  </div>
                ) : (
                  <ProductGrid items={products} />
                )}
              </div>

              <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-[var(--card-border)]/60 bg-[var(--card)]/80 p-4 text-sm text-[color:var(--text-muted)] shadow-sm md:flex-row">
                <div className="text-xs uppercase tracking-[0.2em] text-[color:var(--text-muted)]">
                  Page {meta.currentPage} of {meta.lastPage}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => pushParams({ nextPage: Math.max(1, page - 1) })}
                    disabled={meta.currentPage <= 1 || isLoading}
                    className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)] transition disabled:cursor-not-allowed disabled:opacity-50 hover:border-[var(--accent-strong)] hover:text-[var(--accent-strong)]"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      pushParams({
                        nextPage: meta.lastPage ? Math.min(meta.lastPage, page + 1) : page + 1,
                      })
                    }
                    disabled={(meta.lastPage && meta.currentPage >= meta.lastPage) || isLoading}
                    className="rounded-xl border border-[var(--card-border)] bg-[var(--card)] px-4 py-2 text-sm font-semibold text-[color:var(--text-muted)] transition disabled:cursor-not-allowed disabled:opacity-50 hover:border-[var(--accent-strong)] hover:text-[var(--accent-strong)]"
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
