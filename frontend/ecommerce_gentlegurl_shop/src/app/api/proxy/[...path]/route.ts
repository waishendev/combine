import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const resolvedParams = await params;
  return handleRequest(request, resolvedParams, "GET");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const resolvedParams = await params;
  return handleRequest(request, resolvedParams, "POST");
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const resolvedParams = await params;
  return handleRequest(request, resolvedParams, "PUT");
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const resolvedParams = await params;
  return handleRequest(request, resolvedParams, "DELETE");
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const resolvedParams = await params;
  return handleRequest(request, resolvedParams, "PATCH");
}

async function handleRequest(
  request: NextRequest,
  { path }: { path: string[] },
  method: string,
) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

    // 👇 IMPORTANT: MUST be exactly /api/${path.join('/')}
    // so /api/proxy/public/auth/register -> /api/public/auth/register
    const apiPath = `/api/${path.join("/")}`;
    const url = `${baseUrl}${apiPath}`;

    const searchParams = request.nextUrl.searchParams.toString();
    const fullUrl = searchParams ? `${url}?${searchParams}` : url;

    console.log("[Shop Proxy] Forwarding:", method, fullUrl);
    console.log("[Shop Proxy DEBUG]", method, apiPath, "=>", fullUrl);

    // Forward cookies
    const allCookies = request.cookies.getAll();
    const cookieHeader =
      request.headers.get("cookie") ||
      allCookies.map((c) => `${c.name}=${c.value}`).join("; ") ||
      "";

    let body: string | FormData | undefined;
    let contentType = request.headers.get("content-type") || "";
    const isFormData = contentType.includes("multipart/form-data");

    if (["POST", "PUT", "PATCH"].includes(method)) {
      if (isFormData) {
        body = await request.formData();
      } else {
        try {
          const json = await request.json();
          body = JSON.stringify(json);
          contentType = "application/json";
        } catch {
          const text = await request.text().catch(() => "");
          body = text || undefined;
        }
      }
    }

    const fetchHeaders: HeadersInit = {
      Accept: "application/json",
    };

    if (!isFormData && body) {
      fetchHeaders["Content-Type"] = contentType || "application/json";
    }

    if (cookieHeader) {
      fetchHeaders["Cookie"] = cookieHeader;
    }

    const backendResponse = await fetch(fullUrl, {
      method,
      headers: fetchHeaders,
      credentials: "include",
      ...(body && { body }),
    });

    const responseContentType = backendResponse.headers.get("content-type") || "";
    const isJsonResponse =
      responseContentType.includes("application/json") ||
      responseContentType.includes("application/vnd.api+json");

    if (isJsonResponse) {
      const responseText = await backendResponse.text();
      let data: unknown = {};
      if (responseText.trim() !== "") {
        data = JSON.parse(responseText);
      }

      const nextResponse = NextResponse.json(data, {
        status: backendResponse.status,
      });

      // Handle set-cookie headers - use getAll() to get all set-cookie headers
      const setCookieHeaders = backendResponse.headers.getSetCookie?.() || [];
      
      // Fallback: if getAll() is not available, try get() and parse manually
      if (setCookieHeaders.length === 0) {
        const setCookieHeader = backendResponse.headers.get("set-cookie");
        if (setCookieHeader) {
          // Parse comma-separated cookies (but be careful with dates that contain commas)
          // Simple approach: split by ", " but this might break with complex cookies
          const cookieStrings = setCookieHeader.split(/,\s*(?=\w+\=)/);
          cookieStrings.forEach((cookieString) => {
            const parts = cookieString.split(";");
            const [nameValue] = parts;
            const [name, ...valueParts] = nameValue.split("=");
            const value = valueParts.join("=");

            if (!name || !value) return;

            let httpOnly = false;
            let sameSite: "strict" | "lax" | "none" = "lax";
            let path = "/";
            let maxAge: number | undefined;
            let secure = false;
            let expires: Date | undefined;

            parts.slice(1).forEach((attr) => {
              const trimmed = attr.trim().toLowerCase();
              if (trimmed === "httponly") httpOnly = true;
              if (trimmed === "secure") secure = true;
              if (trimmed.startsWith("samesite=")) {
                const samesiteValue = trimmed.split("=")[1];
                if (samesiteValue === "strict" || samesiteValue === "none") {
                  sameSite = samesiteValue;
                }
              }
              if (trimmed.startsWith("path=")) {
                path = trimmed.split("=")[1];
              }
              if (trimmed.startsWith("max-age=")) {
                maxAge = parseInt(trimmed.split("=")[1], 10);
              }
              if (trimmed.startsWith("expires=")) {
                const expiresValue = attr.trim().substring(8);
                expires = new Date(expiresValue);
              }
            });

            nextResponse.cookies.set(name.trim(), value.trim(), {
              httpOnly,
              sameSite,
              path,
              secure,
              ...(maxAge && { maxAge }),
              ...(expires && { expires }),
            });
          });
        }
      } else {
        // Use getAll() result - parse each cookie string
        setCookieHeaders.forEach((cookieString) => {
          const parts = cookieString.split(";");
          const [nameValue] = parts;
          const [name, ...valueParts] = nameValue.split("=");
          const value = valueParts.join("=");

          if (!name || !value) return;

          let httpOnly = false;
          let sameSite: "strict" | "lax" | "none" = "lax";
          let path = "/";
          let maxAge: number | undefined;
          let secure = false;
          let expires: Date | undefined;

          parts.slice(1).forEach((attr) => {
            const trimmed = attr.trim().toLowerCase();
            if (trimmed === "httponly") httpOnly = true;
            if (trimmed === "secure") secure = true;
            if (trimmed.startsWith("samesite=")) {
              const samesiteValue = trimmed.split("=")[1];
              if (samesiteValue === "strict" || samesiteValue === "none") {
                sameSite = samesiteValue;
              }
            }
            if (trimmed.startsWith("path=")) {
              path = trimmed.split("=")[1];
            }
            if (trimmed.startsWith("max-age=")) {
              maxAge = parseInt(trimmed.split("=")[1], 10);
            }
            if (trimmed.startsWith("expires=")) {
              const expiresValue = attr.trim().substring(8);
              expires = new Date(expiresValue);
            }
          });

          nextResponse.cookies.set(name.trim(), value.trim(), {
            httpOnly,
            sameSite,
            path,
            secure,
            ...(maxAge && { maxAge }),
            ...(expires && { expires }),
          });
        });
      }

      return nextResponse;
    }

    const arrayBuffer = await backendResponse.arrayBuffer();
    const nextResponse = new NextResponse(arrayBuffer, {
      status: backendResponse.status,
    });

    if (responseContentType) {
      nextResponse.headers.set("Content-Type", responseContentType);
    }
    const contentDisposition = backendResponse.headers.get("content-disposition");
    if (contentDisposition) {
      nextResponse.headers.set("Content-Disposition", contentDisposition);
    }
    return nextResponse;
  } catch (error) {
    console.error("[Shop Proxy] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to connect to backend server",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
