import { AccountOverview, getAccountOverview as fetchAccountOverview } from "../apiClient";

export async function getAccountOverview(): Promise<AccountOverview | null> {
  try {
    return await fetchAccountOverview();
  } catch (error) {
    console.error("[getAccountOverview] Error:", error);
    return null;
  }
}
