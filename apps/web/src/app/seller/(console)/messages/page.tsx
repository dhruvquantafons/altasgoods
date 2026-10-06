import { Inbox } from "@/components/seller/messages/inbox";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { healthMetrics, messageTemplates, messageThreads } from "@/lib/mock/seller-extra";

export const metadata = { title: "Messages" };

export default async function MessagesPage(props: PageProps<"/seller/messages">) {
  const sp = await props.searchParams;
  const order = Array.isArray(sp.order) ? sp.order[0] : sp.order;
  const initial = order ? messageThreads.find((t) => t.orderId === order)?.id : undefined;
  const rate = healthMetrics.find((m) => m.key === "response")!;
  return (
    <>
      <PageHeader
        title="Buyer messages"
        description="Reply within 24 hours, including weekends. Messages go through AltasGoods with contact details masked; links, phone numbers, promotions and review requests are blocked."
        meta={
          <>
            <Badge tone="success" dot>
              {rate.value}% answered within 24 hours
            </Badge>
            <span className="text-[13px] text-ink-500">Target over {rate.target}%, last {rate.window}</span>
          </>
        }
      />
      <Inbox threads={messageThreads} templates={messageTemplates} initialId={initial} />
    </>
  );
}
