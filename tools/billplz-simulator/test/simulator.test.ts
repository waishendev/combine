import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import test from "node:test";

import { app } from "../src/app.js";
import { config } from "../src/config.js";
import { deliver, paymentPayload, redirectUrl } from "../src/payment.js";
import { sign, sourceString } from "../src/signature.js";
import { store } from "../src/store.js";
import type { Bill } from "../src/types.js";

const authorization = `Basic ${Buffer.from(`${config.apiKey}:`).toString("base64")}`;
const authHeaders = { authorization };
const validBillInput = {
  collection_id: "collection",
  email: "customer@example.test",
  mobile: "+60123456789",
  name: "Test Customer",
  amount: "1234",
  description: "Order A",
  callback_url: "http://127.0.0.1:1/callback",
  redirect_url: "http://shop.test/payment-result?order=A",
  reference_1_label: "OrderNo",
  reference_1: "A",
};

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address === "object");
  return `http://127.0.0.1:${address.port}`;
}

async function close(server: Server) {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

async function withApp(run: (baseUrl: string) => Promise<void>) {
  const server = createServer(app);
  const baseUrl = await listen(server);
  try {
    await run(baseUrl);
  } finally {
    await close(server);
  }
}

async function createBill(baseUrl: string, overrides: Record<string, string> = {}) {
  const response = await fetch(`${baseUrl}/api/v3/bills`, {
    method: "POST",
    headers: { ...authHeaders, "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...validBillInput, ...overrides }),
  });
  assert.equal(response.status, 201);
  return (await response.json()) as { id: string; amount: number; url: string };
}

async function runScenario(baseUrl: string, billId: string, scenario: string) {
  return fetch(`${baseUrl}/bills/${billId}/scenario`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ scenario }),
  });
}

test("signature generation exactly matches Laravel callback and redirect source rules", () => {
  const payload = { paid: "true", id: "x" };
  assert.equal(sourceString(payload), "idx|paidtrue");
  assert.equal(
    sign(payload, "secret"),
    "9b1a92a5a2cd6f8f0b78867e6ea414586ed0b4809ade4a35e084c3b03f931adf",
  );
  assert.equal(sourceString(payload, true), "billplzidx|billplzpaidtrue");
});

test("API requires Billplz Basic authentication", () =>
  withApp(async (baseUrl) => {
    assert.equal((await fetch(`${baseUrl}/api/v3/bills`, { method: "POST" })).status, 401);
    assert.equal(
      (
        await fetch(`${baseUrl}/api/v3/bills`, {
          method: "POST",
          headers: { authorization: `Basic ${Buffer.from("wrong:").toString("base64")}` },
        })
      ).status,
      401,
    );
  }));

test("bill creation validates input, stores integer cents, and supports lookup", () =>
  withApp(async (baseUrl) => {
    store.clear();
    const invalid = await fetch(`${baseUrl}/api/v3/bills`, {
      method: "POST",
      headers: { ...authHeaders, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ amount: "12.34" }),
    });
    assert.equal(invalid.status, 422);

    const created = await createBill(baseUrl);
    assert.equal(created.amount, 1234);
    assert.match(created.url, new RegExp(`/bills/${created.id}$`));
    assert.equal(store.get(created.id)?.amount, 1234);

    const lookup = await fetch(`${baseUrl}/api/v3/bills/${created.id}`, {
      headers: authHeaders,
    });
    assert.equal(lookup.status, 200);
    const returned = (await lookup.json()) as Record<string, unknown>;
    assert.equal(returned.reference_1, "A");
    assert.equal(returned.paid, false);
    assert.equal(
      (await fetch(`${baseUrl}/api/v3/bills/unknown`, { headers: authHeaders })).status,
      404,
    );
  }));

test("callback delivery is flat form encoded and records successful and failed attempts", async () => {
  let callbackBody = "";
  const callbackServer = createServer((request, response) => {
    request.setEncoding("utf8");
    request.on("data", (chunk) => (callbackBody += chunk));
    request.on("end", () => response.writeHead(202).end("accepted"));
  });
  const callbackUrl = await listen(callbackServer);
  const bill = sampleBill({ callbackUrl });

  const successful = await deliver(bill, paymentPayload(bill, true));
  assert.equal(successful.delivered, true);
  assert.equal(successful.status, 202);
  assert.match(callbackBody, /(^|&)id=sim_test(&|$)/);
  assert.doesNotMatch(callbackBody, /billplz%5B/);
  assert.match(callbackBody, /x_signature=/);
  await close(callbackServer);

  bill.callbackUrl = "http://127.0.0.1:1/unreachable";
  const failed = await deliver(bill, paymentPayload(bill, true));
  assert.equal(failed.delivered, false);
  assert.ok(failed.error);
});

test("callback timeout is recorded", async () => {
  const hangingServer = createServer(() => undefined);
  const callbackUrl = await listen(hangingServer);
  const bill = sampleBill({ callbackUrl });
  const attempt = await deliver(bill, paymentPayload(bill, true), 20);
  assert.equal(attempt.delivered, false);
  assert.equal(attempt.timeout, true);
  await close(hangingServer);
});

test("hosted scenarios cover payment methods, invalid data, and duplicate delivery", async () => {
  const callbackServer = createServer((_request, response) => response.end("OK"));
  const callbackUrl = await listen(callbackServer);
  await withApp(async (baseUrl) => {
    store.clear();
    const created = await createBill(baseUrl, { callback_url: callbackUrl });

    await runScenario(baseUrl, created.id, "success_fpx");
    assert.equal(store.get(created.id)?.paymentMethod, "online_banking");
    await runScenario(baseUrl, created.id, "success_card");
    assert.equal(store.get(created.id)?.paymentMethod, "credit_card");
    await runScenario(baseUrl, created.id, "invalid_signature");
    await runScenario(baseUrl, created.id, "modified_amount");
    await runScenario(baseUrl, created.id, "duplicate");

    const attempts = store.get(created.id)!.attempts;
    assert.equal(attempts.length, 6);
    const invalid = attempts[2]!.payload;
    const unsigned = Object.fromEntries(
      Object.entries(invalid).filter(([key]) => key !== "x_signature"),
    );
    assert.notEqual(invalid.x_signature, sign(unsigned, config.signatureKey));
    assert.equal(attempts[3]!.payload.amount, "1235");
    assert.deepEqual(attempts[4]!.payload, attempts[5]!.payload);
  });
  await close(callbackServer);
});

test("redirect query is nested, preserves existing query, and supports an invalid signature", () => {
  const bill = sampleBill();
  const validUrl = new URL(redirectUrl(bill, true));
  assert.equal(validUrl.searchParams.get("order"), "A");
  assert.equal(validUrl.searchParams.get("billplz[id]"), bill.id);
  const signature = validUrl.searchParams.get("billplz[x_signature]");
  assert.ok(signature);

  const invalidUrl = new URL(redirectUrl(bill, true, true));
  assert.notEqual(invalidUrl.searchParams.get("billplz[x_signature]"), signature);
});

function sampleBill(overrides: Partial<Bill> = {}): Bill {
  return {
    id: "sim_test",
    collectionId: "collection",
    name: "Test Customer",
    email: "customer@example.test",
    amount: 1234,
    paidAmount: 0,
    description: "Order A",
    callbackUrl: "http://127.0.0.1:1/callback",
    redirectUrl: "http://shop.test/payment-result?order=A",
    reference1: "A",
    paid: false,
    state: "due",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    attempts: [],
    ...overrides,
  };
}
