// Notifications push Web (VAPID). Inactif tant que les clés ne sont pas configurées :
// NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:…).
import { q } from "./db";

export const pushConfigured = () => Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);

export async function sendPushToAll(payload: { title: string; body: string; url: string }) {
  if (!pushConfigured()) return { sent: 0, skipped: "not_configured" as const };
  const webpush = (await import("web-push")).default;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  const subs = await q<{ id: number; endpoint: string; keys: { p256dh: string; auth: string } }>(`select id, endpoint, keys from push_subscriptions`);
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(payload));
      sent++;
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) await q(`delete from push_subscriptions where id=$1`, [s.id]);
    }
  }
  return { sent };
}
