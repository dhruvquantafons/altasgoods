import { SandboxPay } from "@/components/store/sandbox-pay";
import { api, unwrap } from "@/lib/api/server";
import { methodLabel } from "@/lib/api/store-adapters";

export const metadata = { title: "Complete your payment" };

export default async function PayPage(props: PageProps<"/checkout/pay/[paymentId]">) {
  const { paymentId } = await props.params;
  const client = await api();
  const payment = unwrap(await client.GET("/v1/payments/{id}", { params: { path: { id: paymentId } } }), { notFoundOn404: true });
  const order = unwrap(await client.GET("/v1/me/orders/{id}", { params: { path: { id: payment.orderId } } }), { notFoundOn404: true });
  return (
    <SandboxPay
      payment={{ id: payment.id, status: payment.status, amountPaise: payment.amountPaise, failureReason: payment.failureReason, method: methodLabel(payment.method) }}
      order={{ id: order.id, status: order.status, paymentDueBy: order.paymentDueBy, itemCount: order.items.reduce((a, i) => a + i.qty, 0), firstItem: order.items[0]?.title ?? "" }}
    />
  );
}
