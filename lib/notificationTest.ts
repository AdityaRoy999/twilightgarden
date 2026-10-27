import { Capacitor } from "@capacitor/core";
/** Local self-test only: never sends a push request or targets a partner. */
export async function showTestNotification() {
  if (Capacitor.isNativePlatform()) {
    const { LocalNotifications } =
      await import("@capacitor/local-notifications");
    const permission = await LocalNotifications.requestPermissions();
    if (permission.display !== "granted")
      throw new Error("Notification permission denied");
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 999,
          title: "Twilight Garden",
          body: "Your local notifications are working.",
          schedule: { at: new Date(Date.now() + 1000) },
          extra: { url: "/settings/notifications" },
        },
      ],
    });
    return;
  }
  if (!("Notification" in window) || Notification.permission !== "granted")
    throw new Error("Notification permission denied");
  if (!("serviceWorker" in navigator))
    throw new Error("Service workers are unavailable");
  let timer: ReturnType<typeof setTimeout>;
  try {
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("Notification service has not started")),
          5000,
        );
      }),
    ]);
    await registration.showNotification("Twilight Garden", {
      body: "Your local notifications are working.",
      icon: "/twilight.png",
      data: { url: "/settings/notifications" },
    });
  } finally {
    clearTimeout(timer!);
  }
}
