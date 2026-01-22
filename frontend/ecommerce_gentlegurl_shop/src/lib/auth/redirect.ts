type ApiErrorPayload = {
  message?: string;
  errors?: Record<string, string[] | string>;
};

export function getSafeRedirect(redirectParam?: string | null): string | null {
  if (!redirectParam) return null;

  if (!redirectParam.startsWith("/")) {
    return null;
  }

  if (redirectParam.startsWith("//")) {
    return null;
  }

  // Decode the redirect parameter to check for nested redirects
  try {
    const decoded = decodeURIComponent(redirectParam);
    
    // Check if the decoded path contains login or register (prevent redirect loops)
    const pathOnly = decoded.split("?")[0]?.split("#")[0];
    if (pathOnly === "/login" || pathOnly === "/register") {
      return null;
    }
    
    // Also check if the full decoded string contains nested redirects to login/register
    // This prevents chains like /login?redirect=/register?redirect=/login...
    if (decoded.includes("/login?redirect=") || decoded.includes("/register?redirect=")) {
      return null;
    }
  } catch {
    // If decoding fails, just check the original string
    const pathOnly = redirectParam.split("?")[0]?.split("#")[0];
    if (pathOnly === "/login" || pathOnly === "/register") {
      return null;
    }
  }

  return redirectParam;
}

export function extractApiError(error: unknown): string {
  if (typeof error === "object" && error !== null && "data" in error) {
    const data = (error as { data?: ApiErrorPayload }).data;

    if (data?.errors && typeof data.errors === "object") {
      const errorValues = Object.values(data.errors);
      const firstError = errorValues.find((value) => value !== undefined && value !== null);

      if (Array.isArray(firstError) && firstError.length > 0) {
        return String(firstError[0]);
      }

      if (typeof firstError === "string" && firstError.trim().length > 0) {
        return firstError;
      }
    }

    if (data?.message) {
      return data.message;
    }
  }

  if (error instanceof Error && error.message && !error.message.startsWith("API error")) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

export function buildRedirectTarget(pathname: string, search?: string | null): string {
  if (!search) return pathname;

  if (search.startsWith("?")) {
    return `${pathname}${search}`;
  }

  return `${pathname}?${search}`;
}
