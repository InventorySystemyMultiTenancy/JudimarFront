const STATUS_BASE_MINUTES = {
  RECEBIDO: 35,
  PREPARANDO: 24,
  PRONTO: 14,
  SAIU_PARA_ENTREGA: 8,
};

const STATUS_MIN_FLOOR = {
  RECEBIDO: 12,
  PREPARANDO: 10,
  PRONTO: 6,
  SAIU_PARA_ENTREGA: 2,
};

const STATUS_DECAY = {
  RECEBIDO: 1,
  PREPARANDO: 0.65,
  PRONTO: 0.5,
  SAIU_PARA_ENTREGA: 0.35,
};

const FINAL_STATUS = new Set(["ENTREGUE", "CANCELADO"]);

function getElapsedMinutes(createdAt, now) {
  const created = new Date(createdAt).getTime();
  const current = new Date(now).getTime();
  return Math.max(0, Math.round((current - created) / 60000));
}

export function getOrderEta(order, now = new Date()) {
  if (!order) {
    return null;
  }

  if (order.status === "ENTREGUE") {
    return {
      label: "Entregue",
      shortLabel: "Entregue",
      tone: "success",
      minutesRemaining: 0,
      expectedAt: null,
      isFinal: true,
      isOverdue: false,
    };
  }

  if (order.status === "CANCELADO") {
    return {
      label: "Cancelado",
      shortLabel: "Cancelado",
      tone: "neutral",
      minutesRemaining: null,
      expectedAt: null,
      isFinal: true,
      isOverdue: false,
    };
  }

  const elapsedMinutes = getElapsedMinutes(order.createdAt, now);
  const base = STATUS_BASE_MINUTES[order.status] ?? 20;
  const floor = STATUS_MIN_FLOOR[order.status] ?? 5;
  const decay = STATUS_DECAY[order.status] ?? 0.5;
  const minutesRemaining = Math.max(
    Math.round(base - elapsedMinutes * decay),
    floor,
  );
  const expectedAt = new Date(
    new Date(now).getTime() + minutesRemaining * 60000,
  );
  const isOverdue = !FINAL_STATUS.has(order.status) && elapsedMinutes > 55;
  const tone = isOverdue
    ? "danger"
    : minutesRemaining <= 8
      ? "warning"
      : "info";

  return {
    label: isOverdue
      ? `Atrasado · ${minutesRemaining} min estimados`
      : `${minutesRemaining} min restantes`,
    shortLabel: `${minutesRemaining} min`,
    tone,
    minutesRemaining,
    expectedAt,
    isFinal: false,
    isOverdue,
  };
}

export function formatExpectedTime(date) {
  if (!date) {
    return null;
  }

  return new Date(date).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function compareOrdersByUrgency(
  firstOrder,
  secondOrder,
  now = new Date(),
) {
  const firstEta = getOrderEta(firstOrder, now);
  const secondEta = getOrderEta(secondOrder, now);

  if (firstEta?.isOverdue && !secondEta?.isOverdue) {
    return -1;
  }

  if (!firstEta?.isOverdue && secondEta?.isOverdue) {
    return 1;
  }

  const firstRemaining = firstEta?.minutesRemaining ?? Number.MAX_SAFE_INTEGER;
  const secondRemaining =
    secondEta?.minutesRemaining ?? Number.MAX_SAFE_INTEGER;

  if (firstRemaining !== secondRemaining) {
    return firstRemaining - secondRemaining;
  }

  return (
    new Date(firstOrder.createdAt).getTime() -
    new Date(secondOrder.createdAt).getTime()
  );
}
