const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(/\/$/, "");

export function normalizeImageUrl(path?: string | null): string {
  if (!path) return "";

  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  if (path.startsWith("/")) {
    return apiBaseUrl ? `${apiBaseUrl}${path}` : path;
  }

  const trimmedPath = path.replace(/^storage\//, "");
  return apiBaseUrl
    ? `${apiBaseUrl}/storage/${trimmedPath}`
    : `/storage/${trimmedPath}`;
}
