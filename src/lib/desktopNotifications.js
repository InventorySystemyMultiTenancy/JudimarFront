const DESKTOP_NOTIFICATIONS_KEY = "pc_desktop_notifications_enabled";

export function supportsDesktopNotifications() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getDesktopNotificationsEnabled() {
  if (typeof window === "undefined") {
    return false;
  }

  const cached = localStorage.getItem(DESKTOP_NOTIFICATIONS_KEY);
  return cached === "true";
}

export function setDesktopNotificationsEnabled(enabled) {
  localStorage.setItem(DESKTOP_NOTIFICATIONS_KEY, String(enabled));
}

export async function requestDesktopNotificationPermission() {
  if (!supportsDesktopNotifications()) {
    return "unsupported";
  }

  if (Notification.permission === "granted") {
    return "granted";
  }

  if (Notification.permission === "denied") {
    return "denied";
  }

  return Notification.requestPermission();
}

export function showDesktopNotification(title, options = {}) {
  if (
    !supportsDesktopNotifications() ||
    Notification.permission !== "granted"
  ) {
    return null;
  }

  const notification = new Notification(title, {
    silent: false,
    ...options,
  });

  return notification;
}
