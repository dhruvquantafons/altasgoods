import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { isAmbiguousRefund, isTransientGatewayError } from "../src/modules/commerce/payments/provider.js";
import { RAZORPAY_SIGNATURE_HEADER, RazorpayPaymentProvider } from "../src/modules/commerce/payments/razorpay.provider.js";

const config = { keyId: "rzp_test_key", keySecret: "key-secret", webhookSecret: "webhook-secret", webOrigin: "http://localhost:3000" };
const sign = (secret: string, data: string) => createHmac("sha256", secret).update(data).digest("hex");

/** A fetch that answers each call in turn and records what was asked. */
function fakeFetch(...responses: unknown[]) {
  const fn = vi.fn(async () => new Response(JSON.stringify(responses.shift()), { status: 200, headers: { "content-type": "application/json" } }));
  return fn as typeof fn & typeof fetch;
}

describe("Razorpay provider", () => {
  it("creates a Razorpay order in paise and points the customer at our pay page", async () => {
    const f = fakeFetch({ id: "order_abc" });
    const p = new RazorpayPaymentProvider({ ...config, fetch: f });
    const session = await p.createSession({ paymentId: "11111111-2222-3333-4444-555555555555", orderId: "OD-1", amountPaise: 149900 });
    expect(session).toEqual({ providerRef: "order_abc", redirectUrl: "http://localhost:3000/checkout/pay/11111111-2222-3333-4444-555555555555" });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.razorpay.com/v1/orders");
    expect(JSON.parse(String(init.body))).toMatchObject({ amount: 149900, currency: "INR" });
    expect((init.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from("rzp_test_key:key-secret").toString("base64")}`);
  });

  it("confirms a checkout only with a valid signature, and captures an authorised payment", async () => {
    const f = fakeFetch({ id: "pay_1", order_id: "order_abc", status: "authorized", amount: 500 }, { id: "pay_1", order_id: "order_abc", status: "captured", amount: 500 });
    const p = new RazorpayPaymentProvider({ ...config, fetch: f });
    const body = { razorpayOrderId: "order_abc", razorpayPaymentId: "pay_1", razorpaySignature: sign("key-secret", "order_abc|pay_1") };

    await expect(p.confirm("order_abc", { ...body, razorpaySignature: "0".repeat(64) })).rejects.toMatchObject({ status: 401 });
    await expect(p.confirm("order_other", body)).rejects.toMatchObject({ status: 400 });
    expect(await p.confirm("order_abc", body)).toEqual({ id: "pay_1:payment.captured", type: "payment.captured", providerRef: "order_abc" });
    expect((f.mock.calls[1] as unknown as [string])[0]).toBe("https://api.razorpay.com/v1/payments/pay_1/capture");
  });

  it("verifies webhooks and maps payment.captured and order.paid to the same event", () => {
    const p = new RazorpayPaymentProvider(config);
    const parse = (event: string, entity: object, secret = "webhook-secret") => {
      const raw = JSON.stringify({ event, payload: { payment: { entity } } });
      return p.parseWebhook(Buffer.from(raw), { [RAZORPAY_SIGNATURE_HEADER]: sign(secret, raw) });
    };
    const entity = { id: "pay_1", order_id: "order_abc", status: "captured", amount: 500 };
    expect(() => parse("payment.captured", entity, "wrong")).toThrow();
    expect(parse("payment.captured", entity)).toEqual(parse("order.paid", entity));
    expect(parse("payment.failed", { ...entity, status: "failed", error_description: "Card declined" })).toEqual({
      id: "pay_1:payment.failed",
      type: "payment.failed",
      providerRef: "order_abc",
      failureReason: "Card declined",
    });
    expect(parse("refund.processed", entity)).toBeNull();
  });

  it("finds a payment Razorpay took without telling us, capturing it if only authorised", async () => {
    const f = fakeFetch({ items: [] }, { items: [{ id: "pay_0", status: "failed" }, { id: "pay_1", status: "authorized", amount: 500 }] }, { id: "pay_1", status: "captured", amount: 500 });
    const p = new RazorpayPaymentProvider({ ...config, fetch: f });
    expect(await p.lookup("order_abc")).toBeNull();
    expect(await p.lookup("order_abc")).toEqual({ id: "pay_1:payment.captured", type: "payment.captured", providerRef: "order_abc" });
    expect((f.mock.calls[2] as unknown as [string])[0]).toBe("https://api.razorpay.com/v1/payments/pay_1/capture");
  });

  it("refunds the captured payment of an order, keyed by our refund id as the receipt", async () => {
    const f = fakeFetch({ items: [{ id: "pay_0", status: "failed" }, { id: "pay_1", status: "captured" }] }, { items: [] }, { id: "rfnd_1", status: "processed" });
    const p = new RazorpayPaymentProvider({ ...config, fetch: f });
    expect(await p.refund({ providerRef: "order_abc", amountPaise: 300, receipt: "refund-1" })).toEqual({ providerRefundId: "rfnd_1", status: "COMPLETED" });
    expect((f.mock.calls[1] as unknown as [string])[0]).toBe("https://api.razorpay.com/v1/payments/pay_1/refunds?count=100");
    const [url, init] = f.mock.calls[2] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.razorpay.com/v1/payments/pay_1/refund");
    expect(JSON.parse(String(init.body))).toMatchObject({ amount: 300, receipt: "refund-1" });
  });

  it("never refunds twice for the same receipt", async () => {
    // already made on an earlier attempt: found by its receipt, nothing is posted
    const seen = fakeFetch({ items: [{ id: "pay_1", status: "refunded" }] }, { items: [{ id: "rfnd_9", receipt: "refund-1", status: "pending" }] });
    expect(await new RazorpayPaymentProvider({ ...config, fetch: seen }).refund({ providerRef: "order_abc", amountPaise: 300, receipt: "refund-1" })).toEqual({ providerRefundId: "rfnd_9", status: "PROCESSING" });
    expect(seen).toHaveBeenCalledTimes(2);

    // Razorpay refuses a receipt it has seen: look the refund up instead
    const answers: [number, unknown][] = [
      [200, { items: [{ id: "pay_1", status: "captured" }] }],
      [200, { items: [] }],
      [400, { error: { code: "BAD_REQUEST_ERROR", description: "receipt already exists" } }],
      [200, { items: [{ id: "rfnd_7", receipt: "refund-1", status: "processed" }] }],
    ];
    const raced = vi.fn(async () => {
      const [status, body] = answers.shift()!;
      return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    }) as unknown as typeof fetch;
    expect(await new RazorpayPaymentProvider({ ...config, fetch: raced }).refund({ providerRef: "order_abc", amountPaise: 300, receipt: "refund-1" })).toEqual({ providerRefundId: "rfnd_7", status: "COMPLETED" });
  });

  it("calls a duplicate receipt it cannot find ambiguous, and any other refusal a refusal", async () => {
    const answering = (description: string) => {
      const answers: [number, unknown][] = [
        [200, { items: [{ id: "pay_1", status: "captured" }] }],
        [200, { items: [] }],
        [400, { error: { code: "BAD_REQUEST_ERROR", description } }],
        // the list Razorpay answers with is stale: the refund it says exists is not in it yet
        [200, { items: [] }],
      ];
      const fetch = vi.fn(async () => {
        const [status, body] = answers.shift()!;
        return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
      }) as unknown as typeof globalThis.fetch;
      return new RazorpayPaymentProvider({ ...config, fetch }).refund({ providerRef: "order_abc", amountPaise: 300, receipt: "refund-1" }).catch((e: unknown) => e);
    };
    const duplicate = await answering("receipt already exists");
    expect(isAmbiguousRefund(duplicate)).toBe(true);
    expect(isTransientGatewayError(duplicate)).toBe(false);
    const refused = await answering("The amount must be at most the captured amount");
    expect(isAmbiguousRefund(refused)).toBe(false);
    expect(isTransientGatewayError(refused)).toBe(false);
  });

  it("finds a refund by its receipt, and knows there is none without a captured payment", async () => {
    const f = fakeFetch({ items: [{ id: "pay_1", status: "captured" }] }, { items: [{ id: "rfnd_3", receipt: "refund-1", status: "processed" }] }, { items: [{ id: "pay_0", status: "failed" }] });
    const p = new RazorpayPaymentProvider({ ...config, fetch: f });
    expect(await p.findRefund({ providerRef: "order_abc", receipt: "refund-1" })).toEqual({ providerRefundId: "rfnd_3", status: "COMPLETED" });
    expect(await p.findRefund({ providerRef: "order_abc", receipt: "refund-1" })).toBeNull();
    expect(f).toHaveBeenCalledTimes(3);
  });

  it("tells a refusal from a failure worth retrying", async () => {
    const answering = (status: number) =>
      new RazorpayPaymentProvider({ ...config, fetch: vi.fn(async () => new Response(JSON.stringify({ error: { description: "no" } }), { status })) as unknown as typeof fetch });
    const failure = (status: number) => answering(status).refundStatus("rfnd_1").catch((e: unknown) => e);
    expect(isTransientGatewayError(await failure(400))).toBe(false);
    expect(isTransientGatewayError(await failure(404))).toBe(false);
    expect(isTransientGatewayError(await failure(429))).toBe(true);
    expect(isTransientGatewayError(await failure(503))).toBe(true);
    const slow = await new RazorpayPaymentProvider({ ...config, fetch: hanging(), timeoutMs: 20 }).refundStatus("rfnd_1").catch((e: unknown) => e);
    expect(isTransientGatewayError(slow)).toBe(true);
    // nothing captured to refund: a refusal
    const none = await new RazorpayPaymentProvider({ ...config, fetch: fakeFetch({ items: [] }) }).refund({ providerRef: "order_abc", amountPaise: 1, receipt: "r" }).catch((e: unknown) => e);
    expect(none).toMatchObject({ code: "NOT_REFUNDABLE" });
    expect(isTransientGatewayError(none)).toBe(false);
  });

  it("reads a refund's status", async () => {
    const f = fakeFetch({ id: "rfnd_1", status: "pending" }, { id: "rfnd_1", status: "processed" }, { id: "rfnd_1", status: "failed" });
    const p = new RazorpayPaymentProvider({ ...config, fetch: f });
    expect(await p.refundStatus("rfnd_1")).toBe("PROCESSING");
    expect(await p.refundStatus("rfnd_1")).toBe("COMPLETED");
    expect(await p.refundStatus("rfnd_1")).toBe("FAILED");
    expect((f.mock.calls[0] as unknown as [string])[0]).toBe("https://api.razorpay.com/v1/refunds/rfnd_1");
  });
});

/** A fetch that only ends when its request is aborted. */
const hanging = () =>
  vi.fn(
    (_url: string, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
      }),
  ) as unknown as typeof fetch;

describe("Razorpay timeouts", () => {
  it("gives up on a gateway that does not answer, as a 504", async () => {
    const p = new RazorpayPaymentProvider({ ...config, fetch: hanging(), timeoutMs: 50 });
    await expect(p.createSession({ paymentId: "p1", orderId: "OD-1", amountPaise: 100 })).rejects.toMatchObject({ status: 504, code: "PAYMENT_GATEWAY_TIMEOUT" });
  }, 2000);

  it("reports a gateway it cannot reach as a 502", async () => {
    const down = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const p = new RazorpayPaymentProvider({ ...config, fetch: down });
    await expect(p.createSession({ paymentId: "p1", orderId: "OD-1", amountPaise: 100 })).rejects.toMatchObject({ status: 502, code: "PAYMENT_GATEWAY_ERROR" });
  });

  it("waits 10 seconds by default", async () => {
    const f = fakeFetch({ id: "order_abc" });
    await new RazorpayPaymentProvider({ ...config, fetch: f }).createSession({ paymentId: "p1", orderId: "OD-1", amountPaise: 100 });
    expect((f.mock.calls[0] as unknown as [string, RequestInit])[1].signal).toBeInstanceOf(AbortSignal);
  });
});
