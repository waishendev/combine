import { NextRequest } from "next/server";
import { proxyRequest } from "@/lib/server/proxyRequest";

type RouteParams = {
  params: Promise<{
    path?: string[];
  }>;
};

async function handler(request: NextRequest, { params }: RouteParams) {
  const resolvedParams = await params;
  return proxyRequest(request, resolvedParams.path);
}

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE, handler as OPTIONS, handler as HEAD };
