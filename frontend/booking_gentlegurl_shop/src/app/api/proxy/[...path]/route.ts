import { NextRequest, NextResponse } from "next/server";

async function handler(request: NextRequest, path: string[]) {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";
  const target = `${baseUrl.replace(/\/$/, "")}/api/${path.join("/")}${request.nextUrl.search}`;

  const headers = new Headers(request.headers);
  headers.delete("host");

  const init: RequestInit = {
    method: request.method,
    headers,
  };

  if (!["GET", "HEAD"].includes(request.method)) {
    init.body = await request.arrayBuffer();
  }

  const upstream = await fetch(target, init);
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("transfer-encoding");

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return handler(request, (await params).path);
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return handler(request, (await params).path);
}
export async function PUT(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return handler(request, (await params).path);
}
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return handler(request, (await params).path);
}
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return handler(request, (await params).path);
}

export const dynamic = "force-dynamic";
