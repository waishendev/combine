import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/login`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(request.headers.get("cookie")
            ? { Cookie: request.headers.get("cookie")! }
            : {}),
        },
        body: JSON.stringify(body),
      }
    );

    const text = await response.text();
    const data = text ? JSON.parse(text) : {};

    const nextResponse = NextResponse.json(data, {
      status: response.status,
    });

    // ✅ 关键：原样转发 Set-Cookie（不要 parse）
    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      nextResponse.headers.append("set-cookie", setCookie);
    }

    return nextResponse;
  } catch (error) {
    console.error("[LOGIN API ERROR]", error);
    return NextResponse.json(
      { error: "Failed to connect to backend server" },
      { status: 500 }
    );
  }
}
