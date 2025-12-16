export type SimpleRecord = {
  id: number;
  name: string;
  status?: string;
};

export type Order = {
  id: number;
  order_number: string;
  customer: string;
  grand_total: number;
  status: string;
  payment_status: string;
  placed_at: string;
};

export type DashboardMetric = {
  label: string;
  value: string | number;
  helper?: string;
};

export type LoyaltySetting = {
  id: number;
  base_multiplier: string;
  expiry_months: number;
  evaluation_cycle_months: number;
  rules_effective_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LoyaltySettingsResponse = {
  current: LoyaltySetting;
  history: LoyaltySetting[];
};
