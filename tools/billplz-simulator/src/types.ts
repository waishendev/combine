export type PaymentMethod = "online_banking" | "credit_card";

export interface CallbackAttempt {
  attempt: number;
  targetUrl: string;
  timestamp: string;
  payload: Record<string, string>;
  status?: number | undefined;
  bodyPreview?: string | undefined;
  durationMs: number;
  error?: string | undefined;
  timeout: boolean;
  delivered: boolean;
}

export interface Bill {
  id: string;
  collectionId: string;
  email?: string;
  mobile?: string;
  name: string;
  amount: number;
  paidAmount: number;
  description: string;
  callbackUrl: string;
  redirectUrl: string;
  reference1Label?: string;
  reference1?: string;
  reference2Label?: string;
  reference2?: string;
  paid: boolean;
  state: string;
  paymentMethod?: PaymentMethod;
  createdAt: string;
  updatedAt: string;
  attempts: CallbackAttempt[];
  lastPayload?: Record<string, string>;
  scenario?: string;
}
