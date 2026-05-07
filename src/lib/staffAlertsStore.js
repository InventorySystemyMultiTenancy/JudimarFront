const STAFF_UNREAD_STORAGE_KEY = "pc_staff_unread_orders";
const STAFF_UNREAD_EVENT_NAME = "pc:staff-unread-updated";

function readCount() {
  const value = localStorage.getItem(STAFF_UNREAD_STORAGE_KEY);
  const parsed = Number.parseInt(value ?? "0", 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function dispatchCount(count) {
  window.dispatchEvent(
    new CustomEvent(STAFF_UNREAD_EVENT_NAME, {
      detail: { count },
    }),
  );
}

export function getStaffUnreadCount() {
  return readCount();
}

export function incrementStaffUnreadCount() {
  const nextCount = readCount() + 1;
  localStorage.setItem(STAFF_UNREAD_STORAGE_KEY, String(nextCount));
  dispatchCount(nextCount);
  return nextCount;
}

export function clearStaffUnreadCount() {
  localStorage.setItem(STAFF_UNREAD_STORAGE_KEY, "0");
  dispatchCount(0);
}

export function subscribeToStaffUnreadCount(listener) {
  const handler = (event) => {
    listener(event.detail?.count ?? 0);
  };

  window.addEventListener(STAFF_UNREAD_EVENT_NAME, handler);

  return () => {
    window.removeEventListener(STAFF_UNREAD_EVENT_NAME, handler);
  };
}
