import { getAccountOverview } from "./getAccountOverview";

export async function getUser() {
  try {
    return await getAccountOverview();
  } catch {
    return null;
  }
}
