import { redirect } from "next/navigation";
import { fetchCustomerProfile } from "@/lib/auth";

export async function requireCustomer(returnTo: string) {
  const res = await fetchCustomerProfile();
  if (!res.data) {
    redirect(`/auth/login?returnTo=${encodeURIComponent(returnTo)}`);
  }
  return res.data;
}
