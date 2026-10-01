import { NotificationInbox, NotificationPrefs } from "@/components/account/notification-center";
import { PageHeader } from "@/components/ui/page-header";
import { accountNotifications, NOTIFICATION_PREFS } from "@/lib/mock/account-extra";
import { timeAgo } from "@/lib/utils";

export const metadata = { title: "Notifications" };

export default function NotificationsPage() {
  const inbox = accountNotifications.map((n) => ({ id: n.id, kind: n.kind, title: n.title, body: n.body.replace(/^(\d[\d,]*) has been credited/, "₹$1 has been credited"), when: timeAgo(n.at), read: n.read, href: n.href }));
  return (
    <>
      <PageHeader title="Notifications" description="Updates about your orders, money and account, and how you want to hear from us." />
      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <NotificationInbox initial={inbox} />
        </div>
        <div className="min-w-0">
          <NotificationPrefs initial={NOTIFICATION_PREFS} />
        </div>
      </div>
    </>
  );
}
