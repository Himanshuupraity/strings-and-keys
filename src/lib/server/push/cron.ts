import { reminderMessage, selectDue } from "./schedule";
import type { SubscriptionRow } from "./store";
import type { SendResult } from "./send";

/** One cron pass: notify everyone who is due, mark them sent, drop dead subscriptions. */
export async function runReminderPass(
  deps: {
    list: () => Promise<SubscriptionRow[]>;
    send: (row: SubscriptionRow, payload: { title: string; body: string; url: string }) => Promise<SendResult>;
    markSent: (endpoint: string, localDate: string) => Promise<void>;
    remove: (endpoint: string) => Promise<void>;
  },
  now = new Date(),
): Promise<{ checked: number; sent: number; removed: number; failed: number }> {
  const rows = await deps.list();
  const due = selectDue(rows, now);
  let sent = 0;
  let removed = 0;
  let failed = 0;
  for (const { row, localDate } of due) {
    const result = await deps.send(row, reminderMessage(localDate));
    if (result === "sent") {
      await deps.markSent(row.endpoint, localDate);
      sent++;
    } else if (result === "gone") {
      await deps.remove(row.endpoint);
      removed++;
    } else {
      failed++;
    }
  }
  return { checked: rows.length, sent, removed, failed };
}
