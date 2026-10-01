import { redirect } from "next/navigation";
import { OrderConfirmation } from "@/components/store/order-confirmation";
import { api, currentUser, unwrap } from "@/lib/api/server";
import { toPlacedOrder } from "@/lib/api/store-adapters";

export const metadata = { title: "Order placed" };

export default async function OrderConfirmedPage(props: PageProps<"/order/confirmed">) {
  const sp = await props.searchParams;
  const id = typeof sp.id === "string" ? sp.id : "";
  if (!/^BB-\d{6}-\d{5,}$/.test(id)) redirect("/account/orders");
  const [user, order] = await Promise.all([currentUser(), (await api()).GET("/v1/me/orders/{id}", { params: { path: { id } } }).then((r) => unwrap(r, { notFoundOn404: true }))]);
  // an order still waiting for payment belongs on the payment page
  if (order.status === "PAYMENT_PENDING" || order.status === "PAYMENT_FAILED") {
    const open = order.payments.find((p) => p.status === "CREATED" || p.status === "PENDING" || p.status === "FAILED");
    if (open) redirect(`/checkout/pay/${open.id}`);
  }
  return (
    <OrderConfirmation
      fallback={toPlacedOrder(order, !!user?.isPlus)}
      requestedId={order.id}
      firstName={user?.name?.split(" ")[0] ?? "there"}
      phone={order.address.phone.replace(/^\+91/, "")}
    />
  );
}
