export type ShopMenuItem = {
  id: number;
  name: string;
  slug: string;
  sort_order: number;
  is_active: boolean;
};

export type Category = {
  id: number;
  name: string;
  slug: string;
};

export type Product = {
  id: number;
  name: string;
  slug: string;
  sku: string | null;
  price: string;
  stock_quantity: number;
  thumbnail_url?: string | null;
  description?: string | null;
};

export type CartItem = {
  id: number;
  product_id: number;
  product_name: string;
  quantity: number;
  unit_price: string;
  line_total: string;
};

export type Cart = {
  items: CartItem[];
  subtotal: string;
  discount_total: string;
  shipping_fee: string;
  grand_total: string;
};

export type PromotionItem = {
  id: number;
  title: string;
  text: string;
  image_path?: string | null;
  button_label?: string | null;
  button_link?: string | null;
};

export type MarqueeItem = {
  id: number;
  text: string;
  sort_order: number;
};

export type OrderItem = {
  id: number;
  product_name: string;
  sku?: string | null;
  quantity: number;
  unit_price: string;
  line_total: string;
};

export type ReturnRequest = {
  id: number;
  order_no: string;
  status: string;
  type: string;
  reason?: string;
  description?: string;
  admin_note?: string;
  tracking_no?: string | null;
  created_at?: string;
  items?: OrderItem[];
};

export type OrderSummary = {
  order_no: string;
  placed_at?: string;
  status: string;
  payment_status: string;
  payment_method?: string;
  grand_total: string;
};

export type OrderDetail = {
  order_no: string;
  placed_at?: string;
  status: string;
  payment_status: string;
  payment_method?: string;
  grand_total: string;
  shipping_name?: string;
  shipping_phone?: string;
  shipping_address?: string;
  pickup_location?: string;
  allow_return?: boolean;
  items: OrderItem[];
  returns?: ReturnRequest[];
  expected_points?: number;
};

export type WishlistItem = Product;

export type LoyaltySummary = {
  current_points: number;
  tier: string;
  tier_expire_at?: string | null;
  next_review_at?: string | null;
};

export type LoyaltyHistoryItem = {
  id: number;
  date: string;
  type: string;
  description?: string;
  points_change: number;
  balance: number;
};

export type LoyaltyReward = {
  id: number;
  name: string;
  required_points: number;
  type: string;
  description?: string;
};
