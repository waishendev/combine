import { getAccountOverview } from "../apiClient";

export async function getUser() {
  try {
    return await getAccountOverview();
  } catch {
    return null;
  }
}
