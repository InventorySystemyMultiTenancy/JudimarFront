const WAITER_CALLS_STORAGE_KEY = "pc_waiter_calls";
const WAITER_CALLS_EVENT_NAME = "pc:waiter-calls-updated";
const MAX_WAITER_CALLS = 12;

function readCalls() {
  const raw = localStorage.getItem(WAITER_CALLS_STORAGE_KEY);

  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function dispatchCalls(calls) {
  window.dispatchEvent(
    new CustomEvent(WAITER_CALLS_EVENT_NAME, {
      detail: { calls },
    }),
  );
}

export function getWaiterCalls() {
  return readCalls();
}

export function appendWaiterCall(call) {
  const nextCalls = [call, ...readCalls()].slice(0, MAX_WAITER_CALLS);
  localStorage.setItem(WAITER_CALLS_STORAGE_KEY, JSON.stringify(nextCalls));
  dispatchCalls(nextCalls);
  return nextCalls;
}

export function clearWaiterCalls() {
  localStorage.setItem(WAITER_CALLS_STORAGE_KEY, JSON.stringify([]));
  dispatchCalls([]);
}

export function subscribeToWaiterCalls(listener) {
  const handler = (event) => {
    listener(event.detail?.calls ?? []);
  };

  window.addEventListener(WAITER_CALLS_EVENT_NAME, handler);

  return () => {
    window.removeEventListener(WAITER_CALLS_EVENT_NAME, handler);
  };
}
