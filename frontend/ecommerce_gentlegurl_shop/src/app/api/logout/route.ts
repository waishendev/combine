import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.redirect("/");

  res.cookies.set("laravel_session", "", { maxAge: -1, path: "/" });
  res.cookies.set("XSRF-TOKEN", "", { maxAge: -1, path: "/" });

  return res;
}
