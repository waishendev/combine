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

  try {
    const decoded = decodeURIComponent(redirectParam);
    const pathOnly = decoded.split("?")[0]?.split("#")[0];
    if (pathOnly === "/login" || pathOnly === "/register") {
      return null;
    }
    if (decoded.includes("/login?redirect=") || decoded.includes("/register?redirect=")) {
      return null;
    }
  } catch {
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

