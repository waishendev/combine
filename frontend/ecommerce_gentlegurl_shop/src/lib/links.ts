export function normalizeInternalLink(href: string): string {
  if (!href) return href;

  try {
    const url = new URL(href);
    const isLocalHost = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);

    if (isLocalHost) {
      return `${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    return href;
  }

  return href;
}
