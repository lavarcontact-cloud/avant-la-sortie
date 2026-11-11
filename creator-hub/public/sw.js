self.addEventListener("push", (event) => {
  let data = { title: "Creator Hub", body: "", url: "/hub/notifications" };
  try { data = { ...data, ...event.data.json() }; } catch {}
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, data: { url: data.url }, icon: "/icon.svg" }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || "/hub"));
});
