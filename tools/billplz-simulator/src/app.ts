import { randomBytes } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";

import { config } from "./config.js";
import { deliver, paymentPayload, redirectUrl } from "./payment.js";
import { store } from "./store.js";
import type { Bill, PaymentMethod } from "./types.js";

export const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use((request, _response, next) => {
  // Deliberately log only routing data: never Authorization or request bodies.
  console.log(`${new Date().toISOString()} ${request.method} ${request.path}`);
  next();
});

function authenticate(request: Request, response: Response, next: NextFunction) {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Basic ")) {
    return response
      .status(401)
      .set("WWW-Authenticate", 'Basic realm="Billplz Simulator"')
      .json({ error: { message: "Authentication required" } });
  }

  const [username] = Buffer.from(authorization.slice(6), "base64").toString().split(":");
  if (username !== config.apiKey) {
    return response.status(401).json({ error: { message: "Invalid API key" } });
  }

  next();
}

function billResponse(bill: Bill) {
  return {
    id: bill.id,
    collection_id: bill.collectionId,
    paid: bill.paid,
    state: bill.state,
    amount: bill.amount,
    paid_amount: bill.paidAmount,
    url: `${config.publicUrl}/bills/${bill.id}`,
    callback_url: bill.callbackUrl,
    redirect_url: bill.redirectUrl,
    description: bill.description,
    email: bill.email ?? null,
    mobile: bill.mobile ?? null,
    name: bill.name,
    reference_1_label: bill.reference1Label ?? null,
    reference_1: bill.reference1 ?? null,
    reference_2_label: bill.reference2Label ?? null,
    reference_2: bill.reference2 ?? null,
  };
}

function createBill(request: Request, response: Response) {
  const input = request.body as Record<string, unknown>;
  const errors: string[] = [];
  const amount = Number(input.amount);

  if (!input.collection_id) errors.push("collection_id is required");
  if (!input.name) errors.push("name is required");
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    errors.push("amount must be a positive integer in cents");
  }
  for (const field of ["callback_url", "redirect_url"] as const) {
    try {
      new URL(String(input[field] ?? ""));
    } catch {
      errors.push(`${field} must be a valid URL`);
    }
  }
  if (errors.length > 0) return response.status(422).json({ error: { message: errors } });

  const timestamp = new Date().toISOString();
  const bill: Bill = {
    id: `sim_${randomBytes(12).toString("hex")}`,
    collectionId: String(input.collection_id),
    name: String(input.name),
    amount,
    paidAmount: 0,
    description: String(input.description ?? ""),
    callbackUrl: String(input.callback_url),
    redirectUrl: String(input.redirect_url),
    paid: false,
    state: "due",
    createdAt: timestamp,
    updatedAt: timestamp,
    attempts: [],
  };

  const optionalFields = {
    email: "email",
    mobile: "mobile",
    reference1Label: "reference_1_label",
    reference1: "reference_1",
    reference2Label: "reference_2_label",
    reference2: "reference_2",
  } as const;
  for (const [property, field] of Object.entries(optionalFields)) {
    if (input[field] !== undefined && input[field] !== "") {
      (bill as unknown as Record<string, unknown>)[property] = String(input[field]);
    }
  }

  store.save(bill);
  return response.status(201).json(billResponse(bill));
}

app.post("/api/v3/bills", authenticate, createBill);
app.get("/api/v3/bills/:id", authenticate, (request, response) => {
  const bill = store.get(String(request.params.id));
  return bill
    ? response.json(billResponse(bill))
    : response.status(404).json({ error: { message: "Bill not found" } });
});

const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(/[&<>"']/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
      character
    ] ?? character,
  );

function scenarioButton(bill: Bill, scenario: string, label: string) {
  return `<form method="post" action="/bills/${escapeHtml(bill.id)}/scenario"><button name="scenario" value="${scenario}">${label}</button></form>`;
}

app.get("/bills/:id", (request, response) => {
  const bill = store.get(String(request.params.id));
  if (!bill) return response.status(404).send("Bill not found");

  const attempts = bill.attempts
    .map(
      (attempt) =>
        `<li>#${attempt.attempt} ${escapeHtml(attempt.timestamp)} — ${attempt.delivered ? "delivered" : escapeHtml(attempt.error ?? `HTTP ${attempt.status}`)}</li>`,
    )
    .join("");
  const normalActions = [
    ["success_fpx", "Successful Online Banking"],
    ["success_card", "Successful Credit Card"],
    ["failed", "Failed payment"],
    ["cancelled", "Cancelled payment"],
    ["callback_first", "Callback then redirect"],
    ["callback_only", "Callback only"],
    ["redirect_only", "Redirect only"],
    ["redirect_first", "Redirect before callback"],
    ["duplicate", "Duplicate callbacks"],
    ["delayed", "Delayed callback"],
  ];
  const negativeActions = [
    ["invalid_signature", "Invalid callback signature"],
    ["modified_amount", "Modified callback amount (+1 cent)"],
    ["unknown_id", "Unknown callback bill ID"],
    ["callback_failure", "Callback connection failure"],
    ["callback_timeout", "Callback timeout"],
    ["invalid_redirect", "Invalid redirect signature"],
    ["server_error", "Simulator server error"],
  ];

  return response.send(`<!doctype html><html><head><meta charset="utf-8"><title>Bill ${escapeHtml(bill.id)}</title>
<style>body{font:16px system-ui;max-width:960px;margin:40px auto;padding:20px;background:#f6f7fb;color:#172033}section{background:#fff;padding:20px;margin:16px 0;border-radius:12px;box-shadow:0 2px 12px #17203312}.actions{display:flex;flex-wrap:wrap;gap:8px}.actions form{margin:0}button{padding:10px 14px;border:1px solid #bcc5d6;border-radius:7px;background:#fff;cursor:pointer}.danger button{border-color:#d99;color:#900}code{word-break:break-all}small{line-height:1.6}</style></head><body>
<h1>Billplz Local Simulator</h1><section><strong>${escapeHtml(bill.description)}</strong><p>Bill ID: <code>${escapeHtml(bill.id)}</code></p><p>${escapeHtml(bill.name)} · ${escapeHtml(bill.email)} · ${escapeHtml(bill.mobile)}</p><h2>RM ${(bill.amount / 100).toFixed(2)} — ${escapeHtml(bill.state)}</h2><small>Callback: ${escapeHtml(bill.callbackUrl)}<br>Redirect: ${escapeHtml(bill.redirectUrl)}</small><h3>Callback attempts (${bill.attempts.length})</h3><ol>${attempts || "<li>None</li>"}</ol></section>
<section><h2>Payment and delivery scenarios</h2><div class="actions">${normalActions.map(([scenario, label]) => scenarioButton(bill, scenario!, label!)).join("")}</div></section>
<section class="danger"><h2>Negative tests</h2><div class="actions">${negativeActions.map(([scenario, label]) => scenarioButton(bill, scenario!, label!)).join("")}${scenarioButton(bill, "resend", "Resend most recent callback")}</div></section></body></html>`);
});

app.post("/bills/:id/scenario", async (request, response) => {
  const bill = store.get(String(request.params.id));
  if (!bill) return response.status(404).send("Bill not found");

  const scenario = String(request.body.scenario);
  if (scenario === "server_error") return response.status(500).send("Simulated server error");

  const paid = !["failed", "cancelled"].includes(scenario);
  bill.paymentMethod = (scenario === "success_card" ? "credit_card" : "online_banking") as PaymentMethod;
  bill.scenario = scenario;
  bill.paid = paid;
  bill.state = paid ? "paid" : scenario === "cancelled" ? "cancelled" : "due";
  bill.paidAmount = paid ? bill.amount : 0;

  const payload =
    scenario === "resend" && bill.lastPayload
      ? { ...bill.lastPayload }
      : paymentPayload(bill, paid);
  if (scenario === "invalid_signature") {
    payload.x_signature = `invalid${payload.x_signature!.slice(7)}`;
  } else if (scenario === "modified_amount") {
    payload.amount = String(bill.amount + 1);
    payload.x_signature = paymentPayload(bill, paid, { amount: payload.amount }).x_signature!;
  } else if (scenario === "unknown_id") {
    payload.id = "sim_unknown";
    payload.x_signature = paymentPayload(bill, paid, { id: payload.id }).x_signature!;
  }

  if (scenario === "callback_failure") {
    const callbackUrl = bill.callbackUrl;
    bill.callbackUrl = "http://127.0.0.1:1/unreachable";
    await deliver(bill, payload);
    bill.callbackUrl = callbackUrl;
  } else if (scenario === "callback_timeout") {
    await deliver(bill, payload, 1);
  } else if (scenario === "delayed") {
    setTimeout(() => void deliver(bill, payload), 2_000);
    return response.send(`Callback scheduled in 2 seconds. <a href="/bills/${bill.id}">Back</a>`);
  } else if (scenario === "redirect_first") {
    setTimeout(() => void deliver(bill, payload), 2_000);
  } else if (!["redirect_only", "invalid_redirect"].includes(scenario)) {
    await deliver(bill, payload);
    if (scenario === "duplicate") await deliver(bill, payload);
  }

  const shouldRedirect = [
    "success_fpx",
    "success_card",
    "failed",
    "cancelled",
    "callback_first",
    "redirect_only",
    "redirect_first",
    "invalid_redirect",
  ].includes(scenario);
  if (shouldRedirect) {
    return response.redirect(303, redirectUrl(bill, paid, scenario === "invalid_redirect"));
  }

  return response.json({ bill: billResponse(bill), last_attempt: bill.attempts.at(-1) });
});

app.get("/health", (_request, response) => response.json({ ok: true }));
