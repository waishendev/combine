import { NextRequest, NextResponse } from "next/server";

const FORWARD_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"] as const;

function buildTargetUrl(request: NextRequest, pathSegments?: string[]) {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured");
  }

  const normalizedBase = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  const path = pathSegments?.join("/") ?? "";
  const search = request.nextUrl.search;

  return `${normalizedBase}/${path}${search}`;
}

async function createProxyResponse(targetUrl: string, request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.delete("host");

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
  };

  if (!FORWARD_METHODS.includes(request.method as (typeof FORWARD_METHODS)[number])) {
    return NextResponse.json({ message: "Method not allowed" }, { status: 405 });
  }

  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const body = await request.arrayBuffer();
    init.body = body;
  }

  const upstreamResponse = await fetch(targetUrl, init);

  const responseHeaders = new Headers(upstreamResponse.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("transfer-encoding");
  responseHeaders.delete("connection");

  const response = new NextResponse(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders,
  });

  const setCookieHeader = (upstreamResponse.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.();
  if (setCookieHeader && Array.isArray(setCookieHeader)) {
    setCookieHeader.forEach((cookie) => response.headers.append("set-cookie", cookie));
  } else {
    const setCookie = upstreamResponse.headers.get("set-cookie");
    if (setCookie) {
      response.headers.set("set-cookie", setCookie);
    }
  }

  return response;
}

export async function proxyRequest(request: NextRequest, pathSegments?: string[]) {
  const targetUrl = buildTargetUrl(request, pathSegments);
  return createProxyResponse(targetUrl, request);
}
