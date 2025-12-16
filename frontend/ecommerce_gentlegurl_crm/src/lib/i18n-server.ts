import type { LangCode } from "./i18n";

const DICT_LOADERS: Record<LangCode, () => Promise<Record<string, string>>> = {
  EN: async () => (await import("../locales/EN.json")).default,
};

export async function getDictionary(
  lang: LangCode,
): Promise<Record<string, string>> {
  const loader = DICT_LOADERS[lang] ?? DICT_LOADERS.EN;
  return await loader();
}

export async function getTranslator(lang: LangCode) {
  const dict = await getDictionary(lang);
  return (key: string) => dict[key] ?? key;
}
