"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

import EN_DICT from "../locales/EN.json";

export type LangCode = "EN";

type Dict = Record<string, string>;

const FALLBACKS: Record<LangCode, Dict> = {
  EN: EN_DICT,
};

const loadDict = async (): Promise<Dict> =>
  (await import("../locales/EN.json")).default as Dict;

type I18nContextValue = {
  lang: LangCode;
  t: (key: string) => string;
  setLang: (lang: LangCode) => void;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<LangCode>(() => {
    try {
      if (typeof window !== "undefined") {
        const stored = window.localStorage.getItem("lang");
        if (stored === "EN") return "EN";
      }

      if (typeof document !== "undefined") {
        const match = document.cookie.match(/(?:^|;\s*)lang=([^;]+)/);
        if (match && match[1] === "EN") return "EN";
      }
    } catch {
      /* noop */
    }
    return "EN";
  });
  const [dict, setDict] = useState<Dict>(FALLBACKS.EN);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    loadDict()
      .then((nextDict) => {
        if (mounted) setDict(nextDict);
      })
      .catch(() => {
        if (mounted) setDict(FALLBACKS[lang] ?? FALLBACKS.EN);
      });
    return () => {
      mounted = false;
    };
  }, [lang]);

  const setLang = useCallback((next: LangCode) => {
    const normalized = next === "EN" ? "EN" : "EN";
    setLangState(normalized);
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("lang", normalized);
        document.cookie = `lang=${normalized}; path=/; max-age=31536000; samesite=lax`;
        router.refresh();
      }
    } catch {
      /* noop */
    }
  }, [router]);

  const t = useMemo(() => {
    return (key: string) => dict[key] ?? key;
  }, [dict]);

  const value = useMemo(() => ({ lang, t, setLang }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
};

export default I18nProvider;
