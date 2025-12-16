import { getAccountOverview } from "./getAccountOverview";
import { cookies } from "next/headers";

export async function getUser() {
  try {
    const cookieStore = await cookies();
    const hasSession =
      Boolean(cookieStore.get("laravel_session")) || Boolean(cookieStore.get("XSRF-TOKEN"));

    if (!hasSession) {
      return null;
    }

    return await getAccountOverview();
  } catch {
    return null;
  }
}
