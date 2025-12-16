import { customerLogin, type CustomerAuthUser } from "@/lib/auth";
import { apiPost } from "@/lib/api";
import { getExistingSessionToken } from "@/lib/session-token";

export async function loginCustomer(email: string, password: string): Promise<CustomerAuthUser> {
  const existingSessionToken = getExistingSessionToken();
  const res = await customerLogin({ email, password });

  if (existingSessionToken) {
    try {
      await apiPost("/public/shop/cart/merge", { session_token: existingSessionToken });
    } catch (err) {
      console.warn("cart merge error:", err);
    }
  }

  return res.data;
}
