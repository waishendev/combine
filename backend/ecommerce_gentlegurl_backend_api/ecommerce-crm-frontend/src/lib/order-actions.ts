const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL!;

async function parseJsonSafe(res: Response) {
  try {
    return await res.json();
  } catch (error) {
    return null;
  }
}

export async function cancelMyOrder(orderNo: string) {
  const res = await fetch(`${API_BASE}/public/shop/orders/${orderNo}/cancel`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const body = await parseJsonSafe(res);
    throw new Error(body?.message || "Cancel order failed");
  }

  return res.json();
}

export async function payOrderAgain(orderNo: string): Promise<{ data: { billplz_url?: string } }> {
  const res = await fetch(`${API_BASE}/public/shop/orders/${orderNo}/pay-again`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  });

  if (!res.ok) {
    const body = await parseJsonSafe(res);
    throw new Error(body?.message || "Pay again failed");
  }

  return res.json();
}
