import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import EstimatedTimeBadge from "../components/EstimatedTimeBadge.jsx";
import toast from "react-hot-toast";
import { api } from "../lib/api.js";
import { askPaymentMethod } from "../lib/paymentMethodPrompt.js";
import {
  getDesktopNotificationsEnabled,
  requestDesktopNotificationPermission,
  setDesktopNotificationsEnabled,
  supportsDesktopNotifications,
} from "../lib/desktopNotifications.js";
import { compareOrdersByUrgency, getOrderEta } from "../lib/orderEta.js";
import {
  installKitchenOrderAudioUnlock,
  playKitchenAlertTone,
  playKitchenOrderAudio,
} from "../lib/playKitchenAlertTone.js";
import {
  clearStaffUnreadCount,
  getStaffUnreadCount,
  subscribeToStaffUnreadCount,
} from "../lib/staffAlertsStore.js";
import {
  clearWaiterCalls,
  dismissWaiterCall,
  getWaiterCalls,
  subscribeToWaiterCalls,
} from "../lib/waiterCallsStore.js";
import { useTranslation } from "../context/I18nContext.jsx";

const SOUND_STORAGE_KEY = "pc_kitchen_sound_enabled";
const NEW_ORDER_HIGHLIGHT_MS = 20000;

const COLUMNS = [
  {
    key: "AGUARDANDO_PAGAMENTO",
    label: "Aguardando Pagamento",
    virtual: true,
    color: "border-amber-500/40 bg-amber-500/10",
  },
  {
    key: "PREPARANDO",
    label: "Preparando",
    next: "PRONTO",
    color: "border-yellow-500/40 bg-yellow-500/10",
  },
  {
    key: "PRONTO",
    label: "Pronto",
    next: "SAIU_PARA_ENTREGA",
    color: "border-ember/40 bg-ember/10",
  },
  {
    key: "SAIU_PARA_ENTREGA",
    label: "Saiu p/ Entrega",
    next: "ENTREGUE",
    color: "border-green-500/40 bg-green-500/10",
  },
  {
    key: "RETIRADA_PRONTA",
    label: "Retirada no Local",
    virtual: true,
    color: "border-purple-500/40 bg-purple-500/10",
  },
  {
    key: "LEVAR_PARA_MESA",
    label: "Levar para a Mesa",
    virtual: true,
    color: "border-amber-600/40 bg-amber-600/10",
  },
];

// Real order statuses (for drag/advance logic)
const STAGES = COLUMNS.filter((c) => !c.virtual);

const STAGE_BADGE = {
  RECEBIDO: "bg-blue-100 text-blue-700",
  PREPARANDO: "bg-yellow-100 text-yellow-700",
  PRONTO: "bg-orange-100 text-orange-700",
  SAIU_PARA_ENTREGA: "bg-green-100 text-green-700",
};

const NEXT_LABEL = {
  RECEBIDO: "Iniciar Preparo",
  PREPARANDO: "Marcar Pronto",
  PRONTO: "Saiu para Entrega",
  SAIU_PARA_ENTREGA: "Marcar Entregue",
};

function isInHouseOrder(order) {
  return !!(order?.mesaId || order?.comandaId || order?.mesa || order?.comanda);
}

function isMarmitaOrder(order) {
  return String(order?.notes ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .includes("MARMITA");
}

function getNextStageKey(status, order) {
  if ((isInHouseOrder(order) || order?.isPickup) && status === "PREPARANDO") {
    return "SAIU_PARA_ENTREGA";
  }

  return STAGES.find((stage) => stage.key === status)?.next ?? null;
}

function getNextColumnKey(status, order) {
  if (isInHouseOrder(order) && status === "PREPARANDO") {
    return "LEVAR_PARA_MESA";
  }

  if (order?.isPickup && status === "PREPARANDO") {
    return "RETIRADA_PRONTA";
  }

  return getNextStageKey(status, order);
}

const formatTime = (iso) =>
  new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });

function getKitchenOrderTitle(order, t) {
  if (order.mesa) {
    return order.mesa.name ?? `Mesa ${order.mesa.number ?? ""}`.trim();
  }

  if (order.comanda) {
    const number = order.comanda.number ? `Comanda ${order.comanda.number}` : "Comanda";
    return order.comanda.name ? `${number} - ${order.comanda.name}` : number;
  }

  if (order.isPickup) {
    if (isMarmitaOrder(order)) {
      return "MARMITA";
    }
    return t("KITCHEN_PICKUP", "Retirada");
  }

  return order.user?.name ?? t("CLIENT_DASHBOARD_CLIENT", "Cliente");
}

function getKitchenOrderSubtitle(order, t) {
  if (order.mesa) {
    return order.mesa.number ? `Mesa ${order.mesa.number}` : "Mesa";
  }

  if (order.comanda) {
    return order.comanda.number ? `Comanda ${order.comanda.number}` : "Comanda";
  }

  if (order.isPickup) {
    return order.user?.name ?? t("CLIENT_DASHBOARD_CLIENT", "Cliente");
  }

  return order.deliveryAddress ?? t("KITCHEN_DELIVERY", "Entrega");
}

function getKitchenItems(order) {
  return (order.items ?? []).filter(
    (item) => !item.product?.waiterOnly && !item.waiterDeliveredAt,
  );
}

function hasKitchenItems(order) {
  return getKitchenItems(order).length > 0;
}

function getProductImage(item) {
  return (
    item?.product?.imageUrl ??
    item?.product?.image ??
    item?.product?.photo ??
    item?.imageUrl ??
    item?.image ??
    ""
  );
}

function toKitchenAlertText(value) {
  if (!value) return "";

  if (Array.isArray(value)) {
    return value
      .map((entry) =>
        typeof entry === "string"
          ? entry
          : (entry?.name ?? entry?.label ?? entry?.title ?? ""),
      )
      .filter(Boolean)
      .join(", ");
  }

  if (typeof value === "object") {
    return Object.values(value).filter(Boolean).join(", ");
  }

  return String(value);
}

function KitchenAlertStrip({ label, value }) {
  const text = toKitchenAlertText(value);
  if (!text) return null;

  return (
    <div className="mt-2 rounded-xl border-2 border-red-700 bg-red-600 px-3 py-2 text-base font-black uppercase leading-snug text-white shadow-sm">
      {label}: {text.toLocaleUpperCase("pt-BR")}
    </div>
  );
}

function OrderCard({
  order,
  onAdvance,
  advancing,
  now,
  isFresh,
  dragging,
  onDragStart,
  onDragEnd,
  onConfirmPayment,
  onPayLater,
  confirmingPayment,
  onCancel,
  cancelling,
  motoboys = [],
  onAssignMotoboy,
  assigningMotoboy,
  onConfirmDelivery,
  confirmingDelivery,
  largeMode = false,
}) {
  const { t } = useTranslation();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [deliveryCodeInput, setDeliveryCodeInput] = useState("");
  const stage = STAGES.find((s) => s.key === order.status);
  const needsCodeConfirm =
    order.status === "SAIU_PARA_ENTREGA" &&
    !order.isPickup &&
    !isInHouseOrder(order) &&
    !!onConfirmDelivery;
  const nextStatus = getNextStageKey(order.status, order);
  const hasNext = !!nextStatus && !onConfirmPayment && !needsCodeConfirm;
  const eta = getOrderEta(order, now);
  const isPaymentPending = order.paymentStatus === "PENDENTE";
  const kitchenItems = getKitchenItems(order);

  const advanceLabel = advancing
    ? t("KITCHEN_UPDATING", "Atualizando...")
    : isInHouseOrder(order) && order.status === "PREPARANDO"
      ? order.comandaId || order.comanda
        ? "Levar para a Comanda"
        : t("KITCHEN_ADVANCE_TO_TABLE", "Levar para a Mesa")
      : order.isPickup && order.status === "PREPARANDO"
        ? t("KITCHEN_READY_PICKUP", "Pronto p/ Retirada")
      : isInHouseOrder(order) && order.status === "PRONTO"
      ? order.comandaId || order.comanda
        ? "Levar para a Comanda"
        : t("KITCHEN_ADVANCE_TO_TABLE", "Levar para a Mesa")
      : isInHouseOrder(order) && order.status === "SAIU_PARA_ENTREGA"
        ? order.comandaId || order.comanda
          ? "Entregue na Comanda"
          : t("KITCHEN_DELIVERED_AT_TABLE", "Entregue na Mesa")
        : order.isPickup && order.status === "PRONTO"
          ? t("KITCHEN_READY_PICKUP", "Pronto p/ Retirada")
          : order.isPickup && order.status === "SAIU_PARA_ENTREGA"
            ? t("KITCHEN_MARK_PICKED_UP", "Marcar Retirado")
            : t(`KITCHEN_NEXT_${order.status}`, NEXT_LABEL[order.status]);

  return (
    <article
      draggable={hasNext && !advancing}
      onDragStart={() => onDragStart(order)}
      onDragEnd={onDragEnd}
      className={`rounded-2xl border-2 p-4 shadow-sm transition-all duration-200 ${
        isFresh
          ? "animate-pulse border-gold/60 bg-gold/10 shadow-[0_0_18px_rgba(212,169,77,0.2)]"
          : eta?.isOverdue
            ? "border-red-500/50 bg-red-500/10 shadow-[0_0_0_1px_rgba(239,68,68,0.2)]"
            : (stage?.color ?? "border-amber-500/40 bg-amber-500/10")
      } ${dragging ? "cursor-grabbing opacity-60" : hasNext ? "cursor-grab" : "cursor-default"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className={`font-black uppercase tracking-wide text-gray-900 ${
              largeMode ? "text-2xl" : "text-lg"
            }`}
          >
            {getKitchenOrderTitle(order, t)}
          </p>
          <p
            className={`mt-1 font-black text-gray-950 ${
              largeMode ? "text-lg" : "text-base"
            }`}
          >
            {getKitchenOrderSubtitle(order, t)}
          </p>
          <p
            className={`font-bold text-gray-700 ${
              largeMode ? "text-xl" : "text-sm"
            }`}
          >
            {formatTime(order.createdAt)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            className={`shrink-0 rounded-xl font-black ${
              largeMode ? "px-3 py-2 text-base" : "px-2 py-1 text-xs"
            } ${
              STAGE_BADGE[order.status] ?? "bg-gray-200 text-gray-900"
            }`}
          >
            {order.status.replace(/_/g, " ")}
          </span>
          <span
            className={`rounded-xl font-black ${
              largeMode ? "px-3 py-1.5 text-sm" : "px-2 py-1 text-xs"
            } ${
              order.mesa
                ? "bg-amber-100 text-amber-700"
                : order.comanda
                  ? "bg-emerald-100 text-emerald-700"
                : order.isPickup
                  ? "bg-purple-100 text-purple-700"
                  : "bg-sky-100 text-sky-700"
            }`}
          >
            {order.mesa
              ? `🪑 ${t("ADMIN_PANEL_MESA_LABEL", "Mesa")} ${order.mesa.number}`
              : order.comanda
                ? `🎫 Comanda ${order.comanda.number}`
              : order.isPickup
                ? `🏠 ${t("KITCHEN_PICKUP", "Retirada")}`
                : `🛵 ${t("KITCHEN_DELIVERY", "Entrega")}`}
          </span>
          {isPaymentPending && !onConfirmPayment && (
            <span
              className={`rounded-xl bg-amber-100 font-black text-amber-700 ${
                largeMode ? "px-3 py-1.5 text-sm" : "px-2 py-1 text-xs"
              }`}
            >
              💰 {t("KITCHEN_PAYMENT_PENDING", "Pag. pendente")}
            </span>
          )}
        </div>
      </div>

      {isFresh ? (
        <div className="mt-4 inline-flex rounded-full border border-gold/40 bg-gold/10 px-4 py-2 text-sm font-black uppercase tracking-[0.18em] text-gold">
          {t("KITCHEN_NEW_ORDER", "Novo pedido")}
        </div>
      ) : null}

      {isMarmitaOrder(order) ? (
        <div className="mt-4 rounded-2xl border-4 border-orange-700 bg-orange-500 px-4 py-3 text-center text-3xl font-black uppercase tracking-widest text-white shadow-sm">
          MARMITA
        </div>
      ) : null}

      <div className="mt-4 text-base">
        <EstimatedTimeBadge compact now={now} order={order} />
      </div>

      {/* Items */}
      <ul className="mt-4 space-y-4 border-t-2 border-gray-300 pt-4">
        {kitchenItems.map((item) => (
          <li
            key={item.id}
            className={`rounded-2xl border border-gray-200 bg-white/80 ${
              largeMode ? "p-3" : "p-2"
            }`}
          >
            <div className={largeMode ? "flex gap-4" : "flex gap-3"}>
              <div
                className={`shrink-0 overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 ${
                  largeMode ? "h-28 w-28" : "h-20 w-20"
                }`}
              >
                {getProductImage(item) ? (
                  <img
                    src={getProductImage(item)}
                    alt={item.product?.name ?? "Produto"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center px-2 text-center text-sm font-bold uppercase text-gray-500">
                    Sem foto
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <span
                  className={`block font-black leading-tight text-gray-950 ${
                    largeMode ? "text-2xl" : "text-lg"
                  }`}
                >
                  {item.product?.name ?? t("CLIENT_DASHBOARD_ITEM", "Item")}
                </span>
                <span
                  className={`mt-2 inline-flex rounded-xl bg-gray-900 font-black text-white ${
                    largeMode ? "px-3 py-1 text-2xl" : "px-2 py-0.5 text-lg"
                  }`}
                >
                  QTD {item.quantity}
                </span>
                {item.priceVariant && (
                  <span
                    className={`ml-2 mt-2 inline-flex rounded-xl bg-amber-500 font-black uppercase text-gray-950 ${
                      largeMode ? "px-3 py-1 text-xl" : "px-2 py-0.5 text-sm"
                    }`}
                  >
                    {item.priceVariant === "PRATO_FEITO"
                      ? "Prato feito"
                      : "Comercial"}
                  </span>
                )}
              </div>
            </div>
            {item.notes && (
              <p
                className={`mt-2 rounded-xl border-2 border-red-700 bg-red-600 font-black uppercase leading-snug text-white shadow-sm ${
                  largeMode ? "px-3 py-2 text-base" : "px-2 py-1.5 text-sm"
                }`}
              >
                ⚠ {item.notes}
              </p>
            )}
            <KitchenAlertStrip label="Adicionais" value={item.addons} />
            <KitchenAlertStrip
              label="Remover"
              value={item.removedIngredients}
            />
          </li>
        ))}
      </ul>

      {order.notes && (
        <KitchenAlertStrip label="Obs do pedido" value={order.notes} />
      )}

      {/* Payment pending column actions */}
      {onConfirmPayment && (
        <div
          className={`mt-5 grid gap-3 ${
            largeMode ? "sm:grid-cols-2" : "grid-cols-2"
          }`}
        >
          <button
            type="button"
            disabled={confirmingPayment}
            onClick={() => onConfirmPayment(order.id)}
            className={`rounded-2xl bg-green-600 font-black text-white transition hover:bg-green-700 disabled:opacity-50 ${
              largeMode
                ? "min-h-16 px-4 py-4 text-lg"
                : "min-h-12 px-3 py-3 text-sm"
            }`}
          >
            {confirmingPayment
              ? "..."
              : t("KITCHEN_CONFIRM_PAYMENT_BTN", "✅ Confirmar Pgto")}
          </button>
          <button
            type="button"
            disabled={confirmingPayment}
            onClick={() => onPayLater(order.id)}
            className={`rounded-2xl border-2 border-amber-500 bg-amber-50 font-black text-amber-900 transition hover:bg-amber-100 disabled:opacity-50 ${
              largeMode
                ? "min-h-16 px-4 py-4 text-lg"
                : "min-h-12 px-3 py-3 text-sm"
            }`}
          >
            {confirmingPayment
              ? "..."
              : t("KITCHEN_PAY_LATER_BTN", "⏳ Pagar Depois")}
          </button>
        </div>
      )}

      {/* Normal advance button */}
      {hasNext && (
        <button
          type="button"
          disabled={advancing}
          onClick={() => onAdvance(order.id, nextStatus)}
          className={`mt-5 w-full rounded-2xl bg-green-600 font-black uppercase text-white transition hover:bg-green-700 disabled:opacity-50 ${
            largeMode
              ? "min-h-20 px-4 py-5 text-2xl"
              : "min-h-14 px-3 py-3 text-base"
          }`}
        >
          {advanceLabel}
        </button>
      )}

      {/* Delivery confirmation code input */}
      {needsCodeConfirm && (
        <div className="mt-4">
          <p className="mb-1.5 text-[10px] uppercase tracking-widest text-smoke">
            {t("KITCHEN_DELIVERY_CODE_SECTION", "📍 Código do cliente")}
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={deliveryCodeInput}
              onChange={(e) =>
                setDeliveryCodeInput(
                  e.target.value.replace(/\D/g, "").slice(0, 4),
                )
              }
              placeholder="0000"
              className="w-24 rounded-xl border border-gray-300 bg-white px-3 py-2 text-center text-lg font-bold tracking-widest focus:border-green-400 focus:outline-none"
            />
            <button
              type="button"
              disabled={deliveryCodeInput.length !== 4 || confirmingDelivery}
              onClick={() => {
                onConfirmDelivery(order.id, deliveryCodeInput);
                setDeliveryCodeInput("");
              }}
              className="flex-1 rounded-2xl bg-gradient-to-r from-green-500 to-green-600 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40"
            >
              {confirmingDelivery
                ? t("KITCHEN_CONFIRMING_DELIVERY", "Confirmando...")
                : t("KITCHEN_CONFIRM_DELIVERY_BTN", "✓ Confirmar Entrega")}
            </button>
          </div>
        </div>
      )}

      {/* Motoboy assignment — delivery orders only (not mesa) */}
      {!order.isPickup &&
        !isInHouseOrder(order) &&
        onAssignMotoboy &&
        motoboys.length > 0 && (
          <div className="mt-3 border-t border-gray-200 pt-3">
            <p className="mb-1.5 text-[10px] uppercase tracking-widest text-smoke">
              🛵 Motoboy
            </p>
            {order.assignedMotoboyId ? (
              <div className="flex items-center gap-2">
                <span className="flex-1 truncate rounded-xl bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700">
                  {motoboys.find((m) => m.id === order.assignedMotoboyId)
                    ?.name ?? "Motoboy"}
                </span>
                <select
                  value={order.assignedMotoboyId}
                  onChange={(e) => onAssignMotoboy(order.id, e.target.value)}
                  disabled={assigningMotoboy}
                  className="rounded-xl border border-gray-200 bg-white px-2 py-1 text-xs"
                >
                  {motoboys.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <select
                value=""
                onChange={(e) =>
                  e.target.value && onAssignMotoboy(order.id, e.target.value)
                }
                disabled={assigningMotoboy}
                className="w-full rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs"
              >
                <option value="">
                  {t("KITCHEN_SELECT_MOTOBOY", "Selecionar motoboy...")}
                </option>
                {motoboys.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

      {/* Cancel button — shown in all columns including payment pending */}
      {onCancel &&
        (confirmCancel ? (
          <div className="mt-2 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2">
            <span className="flex-1 text-xs text-red-600">
              {t(
                "KITCHEN_CANCEL_CONFIRM_TEXT",
                "Cancelar pedido #{{id}}?",
              ).replace("{{id}}", order.id.slice(-6).toUpperCase())}
            </span>
            <button
              type="button"
              disabled={cancelling}
              onClick={() => {
                setConfirmCancel(false);
                onCancel(order.id);
              }}
              className="rounded-xl bg-red-500 px-3 py-1 text-xs font-bold text-white hover:bg-red-600 disabled:opacity-50"
            >
              {cancelling ? "..." : t("YES", "Sim")}
            </button>
            <button
              type="button"
              onClick={() => setConfirmCancel(false)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-1 text-xs font-semibold hover:bg-gray-100"
            >
              {t("NO", "Não")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={cancelling || advancing || confirmingPayment}
            onClick={() => setConfirmCancel(true)}
            className="mt-2 w-full rounded-2xl border border-red-400/50 bg-red-500/10 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-500/20 disabled:opacity-40"
          >
            {cancelling
              ? t("KITCHEN_CANCELLING", "Cancelando...")
              : t("KITCHEN_CANCEL_ORDER_BTN", "Cancelar Pedido")}
          </button>
        ))}
    </article>
  );
}

function KitchenPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isKitchenUser = user?.role === "COZINHA";
  const canLoadMotoboys = ["ADMIN", "FUNCIONARIO", "COZINHA"].includes(
    user?.role,
  );
  const [now, setNow] = useState(() => Date.now());
  const [latestAlert, setLatestAlert] = useState(null);
  const [freshOrderIds, setFreshOrderIds] = useState([]);
  const [unreadCount, setUnreadCount] = useState(() => getStaffUnreadCount());
  const [waiterCalls, setWaiterCalls] = useState(() => getWaiterCalls());
  const [desktopEnabled, setDesktopEnabled] = useState(() =>
    getDesktopNotificationsEnabled(),
  );
  const [draggedOrder, setDraggedOrder] = useState(null);
  const [activeDropStage, setActiveDropStage] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    const cached = localStorage.getItem(SOUND_STORAGE_KEY);
    return cached === null ? true : cached === "true";
  });
  const effectiveSoundEnabled = isKitchenUser || soundEnabled;
  const previousOverdueIdsRef = useRef([]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (isKitchenUser) {
      localStorage.setItem(SOUND_STORAGE_KEY, "true");
      setDesktopNotificationsEnabled(true);
      return;
    }

    localStorage.setItem(SOUND_STORAGE_KEY, String(soundEnabled));
  }, [isKitchenUser, soundEnabled]);

  const handleDesktopToggle = async () => {
    if (!supportsDesktopNotifications()) {
      return;
    }

    if (desktopEnabled) {
      setDesktopNotificationsEnabled(false);
      setDesktopEnabled(false);
      return;
    }

    const permission = await requestDesktopNotificationPermission();
    const granted = permission === "granted";
    setDesktopNotificationsEnabled(granted);
    setDesktopEnabled(granted);
  };

  const handleDragStart = (order) => {
    setDraggedOrder({
      id: order.id,
      status: order.status,
      nextStatus: getNextStageKey(order.status, order),
      dropColumnKey: getNextColumnKey(order.status, order),
    });
  };

  const handleDragEnd = () => {
    setDraggedOrder(null);
    setActiveDropStage(null);
  };

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/dashboard");
  };

  const handleClearAlerts = () => {
    clearStaffUnreadCount();
    clearWaiterCalls();
  };

  const handleDismissWaiterCall = (call, index) => {
    dismissWaiterCall({ ...call, index });
  };

  const formatRelativeTime = (timestamp) => {
    if (!timestamp) {
      return t("KITCHEN_JUST_NOW", "agora");
    }

    const diffMinutes = Math.max(
      0,
      Math.floor((now - new Date(timestamp).getTime()) / 60000),
    );

    if (diffMinutes < 1) {
      return t("KITCHEN_JUST_NOW", "agora");
    }

    if (diffMinutes === 1) {
      return t("KITCHEN_ONE_MINUTE_AGO", "há 1 min");
    }

    return t("KITCHEN_MINUTES_AGO", "há {{count}} min").replace(
      "{{count}}",
      String(diffMinutes),
    );
  };

  useEffect(() => subscribeToStaffUnreadCount(setUnreadCount), []);
  useEffect(() => subscribeToWaiterCalls(setWaiterCalls), []);
  useEffect(() => installKitchenOrderAudioUnlock(), []);

  useEffect(() => {
    const timeouts = new Map();

    const handleOrderCreated = (event) => {
      const payload = event.detail;

      setLatestAlert({
        orderId: payload.orderId,
        timestamp: Date.now(),
      });

      setFreshOrderIds((current) => {
        const next = current.filter((orderId) => orderId !== payload.orderId);
        return [payload.orderId, ...next];
      });

      if (effectiveSoundEnabled) {
        playKitchenOrderAudio();
      }

      const previousTimeout = timeouts.get(payload.orderId);
      if (previousTimeout) {
        window.clearTimeout(previousTimeout);
      }

      const timeoutId = window.setTimeout(() => {
        setFreshOrderIds((current) =>
          current.filter((orderId) => orderId !== payload.orderId),
        );
        timeouts.delete(payload.orderId);
      }, NEW_ORDER_HIGHLIGHT_MS);

      timeouts.set(payload.orderId, timeoutId);
    };

    window.addEventListener("pc:order-created", handleOrderCreated);

    return () => {
      window.removeEventListener("pc:order-created", handleOrderCreated);
      for (const timeoutId of timeouts.values()) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [effectiveSoundEnabled]);

  useEffect(() => {
    const handleRealtimeReconnected = () => {
      if (effectiveSoundEnabled) {
        playKitchenAlertTone("reconnected");
      }
    };

    window.addEventListener(
      "pc:realtime-reconnected",
      handleRealtimeReconnected,
    );

    return () => {
      window.removeEventListener(
        "pc:realtime-reconnected",
        handleRealtimeReconnected,
      );
    };
  }, [effectiveSoundEnabled]);

  const {
    data: orders = [],
    isLoading,
    isError,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["kitchen-orders"],
    queryFn: async () => {
      const res = await api.get("/orders");
      return res.data?.data ?? [];
    },
    refetchInterval: 120_000,
  });

  const {
    mutate: advance,
    variables: advancingVars,
    isPending,
  } = useMutation({
    mutationFn: async ({ orderId, status }) => {
      const res = await api.patch(`/orders/${orderId}/status`, { status });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kitchen-orders"] });
      toast.success(t("KITCHEN_STATUS_UPDATED", "Status atualizado"));
    },
    onError: () =>
      toast.error(t("KITCHEN_STATUS_ERROR", "Falha ao atualizar status")),
  });

  const { data: motoboys = [] } = useQuery({
    queryKey: ["motoboys"],
    queryFn: async () => {
      const res = await api.get("/admin/motoboys");
      return res.data?.data ?? [];
    },
    staleTime: 60_000,
    enabled: canLoadMotoboys,
  });

  const visibleOrders = useMemo(
    () => {
      const roleFiltered =
        user?.role === "MOTOBOY"
          ? orders.filter((o) => o.assignedMotoboyId === user.id)
          : orders;

      return roleFiltered
        .map((order) => ({
          ...order,
          status: order.status === "RECEBIDO" ? "PREPARANDO" : order.status,
          items: getKitchenItems(order),
        }))
        .filter(hasKitchenItems);
    },
    [orders, user],
  );

  const {
    mutate: assignMotoboy,
    variables: assignVars,
    isPending: isAssigning,
  } = useMutation({
    mutationFn: async ({ orderId, motoboyId }) => {
      await api.patch(`/orders/${orderId}/assign-motoboy`, { motoboyId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kitchen-orders"] });
      toast.success(t("KITCHEN_MOTOBOY_ASSIGNED", "Motoboy atribuído"));
    },
    onError: () =>
      toast.error(t("KITCHEN_MOTOBOY_ERROR", "Falha ao atribuir motoboy")),
  });

  const {
    mutate: confirmDelivery,
    variables: deliveryConfirmVars,
    isPending: isConfirmingDelivery,
  } = useMutation({
    mutationFn: async ({ orderId, code }) => {
      await api.post(`/orders/${orderId}/confirm-delivery`, { code });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kitchen-orders"] });
      toast.success(
        t("KITCHEN_DELIVERY_CONFIRMED_TOAST", "Entrega confirmada!"),
      );
    },
    onError: (err) => {
      const msg = err.response?.data?.message ?? "Código inválido";
      toast.error(msg);
    },
  });

  const {
    mutate: cancelOrder,
    variables: cancelVars,
    isPending: isCancelling,
  } = useMutation({
    mutationFn: async (orderId) => {
      const res = await api.patch(`/orders/${orderId}/cancel`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kitchen-orders"] });
      toast.success(t("KITCHEN_ORDER_CANCELLED", "Pedido cancelado"));
    },
    onError: () =>
      toast.error(t("KITCHEN_CANCEL_ERROR", "Falha ao cancelar pedido")),
  });

  const {
    mutate: setPaymentStatus,
    variables: paymentVars,
    isPending: isPaymentPending,
  } = useMutation({
    mutationFn: async ({
      orderId,
      paymentStatus,
      paymentMethod,
      advanceTo,
      payLater,
    }) => {
      await api.patch(`/orders/${orderId}/payment-status`, {
        paymentStatus,
        ...(paymentMethod ? { paymentMethod } : {}),
        ...(payLater ? { payLater: true } : {}),
      });
      if (advanceTo) {
        await api.patch(`/orders/${orderId}/status`, { status: advanceTo });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kitchen-orders"] });
      toast.success(t("KITCHEN_UPDATED_SUCCESS", "Atualizado com sucesso"));
    },
    onError: () => toast.error(t("KITCHEN_UPDATE_ERROR", "Falha ao atualizar")),
  });

  const lastUpdate = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "--";
  const currentNow = useMemo(() => new Date(now), [now]);
  const overdueCount = useMemo(
    () =>
      visibleOrders.filter((order) => getOrderEta(order, currentNow)?.isOverdue)
        .length,
    [currentNow, visibleOrders],
  );
  const overdueIds = useMemo(
    () =>
      visibleOrders
        .filter((order) => getOrderEta(order, currentNow)?.isOverdue)
        .map((order) => order.id),
    [currentNow, visibleOrders],
  );
  const getColumnOrders = useCallback(
    (columnKey) => {
      if (columnKey === "AGUARDANDO_PAGAMENTO") {
        // Mesa orders never ficam aqui — vão direto pro status real
        return visibleOrders.filter(
          (o) =>
            (o.status === "RECEBIDO" || o.status === "PREPARANDO") &&
            o.paymentStatus === "PENDENTE" &&
            o.paymentMethod !== "PAGAR_DEPOIS" &&
            !isInHouseOrder(o),
        );
      }
      if (columnKey === "SAIU_PARA_ENTREGA") {
        // Só entregas normais (não mesa, não retirada)
        return visibleOrders.filter(
          (o) =>
            o.status === "SAIU_PARA_ENTREGA" &&
            !o.isPickup &&
            !isInHouseOrder(o),
        );
      }
      if (columnKey === "RETIRADA_PRONTA") {
        return visibleOrders.filter(
          (o) => o.status === "SAIU_PARA_ENTREGA" && o.isPickup,
        );
      }
      if (columnKey === "LEVAR_PARA_MESA") {
        return visibleOrders.filter(
          (o) => o.status === "SAIU_PARA_ENTREGA" && isInHouseOrder(o),
        );
      }
      return visibleOrders.filter((o) => o.status === columnKey);
    },
    [visibleOrders],
  );

  const handleConfirmPayment = useCallback(
    async (orderId) => {
      const paymentMethod = await askPaymentMethod({
        title: "Confirmar pagamento",
        text: "Escolha a forma de pagamento recebida.",
      });
      if (!paymentMethod) return;
      setPaymentStatus({
        orderId,
        paymentStatus: "APROVADO",
        paymentMethod,
      });
    },
    [setPaymentStatus],
  );

  const stageCounts = useMemo(
    () =>
      COLUMNS.map((col) => ({
        ...col,
        count: getColumnOrders(col.key).length,
      })),
    [getColumnOrders],
  );
  const previousStageCountsRef = useRef({});
  const [changedStageKeys, setChangedStageKeys] = useState([]);

  useEffect(() => {
    const previousIds = previousOverdueIdsRef.current;
    const newOverdueIds = overdueIds.filter(
      (orderId) => !previousIds.includes(orderId),
    );

    if (newOverdueIds.length && effectiveSoundEnabled) {
      playKitchenAlertTone("overdue");
      toast.error(
        t(
          "KITCHEN_OVERDUE_ALERT",
          "{{count}} pedido(s) entraram em atraso",
        ).replace("{{count}}", String(newOverdueIds.length)),
      );
    }

    previousOverdueIdsRef.current = overdueIds;
  }, [overdueIds, effectiveSoundEnabled, t]);

  useEffect(() => {
    const changedKeys = stageCounts
      .filter(
        (stage) => previousStageCountsRef.current[stage.key] !== undefined,
      )
      .filter(
        (stage) => previousStageCountsRef.current[stage.key] !== stage.count,
      )
      .map((stage) => stage.key);

    if (changedKeys.length) {
      setChangedStageKeys(changedKeys);
      const timeoutId = window.setTimeout(() => {
        setChangedStageKeys([]);
      }, 1400);

      previousStageCountsRef.current = Object.fromEntries(
        stageCounts.map((stage) => [stage.key, stage.count]),
      );

      return () => {
        window.clearTimeout(timeoutId);
      };
    }

    previousStageCountsRef.current = Object.fromEntries(
      stageCounts.map((stage) => [stage.key, stage.count]),
    );
  }, [stageCounts]);

  const visibleColumnKeys =
    isKitchenUser
      ? ["PREPARANDO"]
      : user?.role === "ATENDENTE"
        ? ["LEVAR_PARA_MESA"]
        : user?.role === "FUNCIONARIO"
          ? [
              "AGUARDANDO_PAGAMENTO",
              "PRONTO",
              "SAIU_PARA_ENTREGA",
              "RETIRADA_PRONTA",
            ]
          : null;
  const visibleColumns = visibleColumnKeys
    ? COLUMNS.filter((column) => visibleColumnKeys.includes(column.key))
    : COLUMNS;
  const visibleStageCounts = stageCounts.filter((stage) =>
    visibleColumns.some((column) => column.key === stage.key),
  );
  const showStageSummary = !isKitchenUser;
  const showWaiterCalls = !isKitchenUser;
  const showHeaderDetails = !isKitchenUser;
  const kitchenPreparingOrders = useMemo(() => {
    if (!isKitchenUser) return [];

    return getColumnOrders("PREPARANDO").sort((a, b) =>
      compareOrdersByUrgency(a, b, currentNow),
    );
  }, [currentNow, getColumnOrders, isKitchenUser]);

  if (isKitchenUser) {
    return (
      <main className="min-h-screen bg-ink p-4 text-gray-900 sm:p-6">
        {!isLoading && !isError && (
          <>
            {kitchenPreparingOrders.length === 0 ? (
              <div className="flex min-h-[calc(100vh-2rem)] items-center justify-center text-center sm:min-h-[calc(100vh-3rem)]">
                <div className="rounded-3xl border-2 border-dashed border-gray-300 bg-white/45 px-8 py-10 shadow-sm">
                  <p className="text-5xl font-black uppercase text-gray-900">
                    Sem pedidos no momento
                  </p>
                  <p className="mt-4 text-2xl font-bold text-gray-600">
                    A cozinha esta aguardando novos pedidos.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
                {kitchenPreparingOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    now={currentNow}
                    isFresh={freshOrderIds.includes(order.id)}
                    dragging={false}
                    advancing={isPending && advancingVars?.orderId === order.id}
                    onDragStart={() => {}}
                    onDragEnd={() => {}}
                    onAdvance={(orderId, status) =>
                      advance({ orderId, status })
                    }
                    largeMode
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-ink px-4 py-6 text-gray-900 sm:px-6">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-gold">
            {t("KITCHEN_TITLE", "Cozinha")}
          </h1>
          {showHeaderDetails && (
            <>
          <p className="mt-1 text-xs text-smoke">
            {t(
              "KITCHEN_UPDATED_AT",
              "Atualizado em {{time}} • tempo real com fallback de 2 min",
            ).replace("{{time}}", lastUpdate)}
          </p>
          <p className="mt-1 text-xs text-red-300">
            {overdueCount
              ? t(
                  "KITCHEN_OVERDUE_COUNT",
                  "{{count}} pedidos em atraso",
                ).replace("{{count}}", String(overdueCount))
              : t("KITCHEN_NO_OVERDUE", "Sem pedidos em atraso")}
          </p>
          <p className="mt-1 text-xs text-gold/90">
            {unreadCount
              ? t(
                  "KITCHEN_UNREAD_ALERTS",
                  "{{count}} novos alertas nao lidos",
                ).replace("{{count}}", String(unreadCount))
              : t("KITCHEN_NO_ALERTS", "Nenhum alerta pendente")}
          </p>
          <p className="mt-1 text-xs text-smoke">
            {t("ADMIN_PANEL_DESKTOP_LABEL", "Desktop")}:{" "}
            {desktopEnabled
              ? t("ADMIN_PANEL_DESKTOP_ON", "notificacoes ativas")
              : t("ADMIN_PANEL_DESKTOP_OFF", "notificacoes inativas")}
          </p>
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleGoBack}
            className="rounded-full border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-smoke transition hover:border-gold/30 hover:text-gold"
          >
            {t("BTN_BACK", "Voltar")}
          </button>
          <button
            onClick={handleClearAlerts}
            onClick={() => clearStaffUnreadCount()}
            className="rounded-full border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-smoke transition hover:border-gold/30 hover:text-gold"
          >
            {t("KITCHEN_CLEAR_ALERTS", "Limpar alertas")}{" "}
            {unreadCount ? `(${unreadCount})` : ""}
          </button>
          <button
            type="button"
            onClick={handleDesktopToggle}
            className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
              desktopEnabled
                ? "border-gold/40 bg-gold/10 text-gold"
                : "border-gray-200 bg-gray-50 text-smoke"
            }`}
          >
            {t("ADMIN_PANEL_DESKTOP_LABEL", "Desktop")}{" "}
            {desktopEnabled
              ? t("ADMIN_PANEL_DESKTOP_BUTTON_ON", "ligado")
              : t("ADMIN_PANEL_DESKTOP_BUTTON_OFF", "desligado")}
          </button>
          <button
            type="button"
            onClick={() => setSoundEnabled((current) => !current)}
            className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
              soundEnabled
                ? "border-gold/40 bg-gold/10 text-gold"
                : "border-gray-200 bg-gray-50 text-smoke"
            }`}
          >
            {t("KITCHEN_SOUND", "Som")}{" "}
            {soundEnabled
              ? t("KITCHEN_ON", "ligado")
              : t("KITCHEN_OFF", "desligado")}
          </button>
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-green-500" />
            </span>
            <span className="text-xs text-smoke">
              {t("KITCHEN_LIVE", "Ao vivo")}
            </span>
          </div>
        </div>
      </header>

      {showStageSummary && (
        <section
          className={`mb-5 grid gap-3 ${
            visibleColumns.length === 3
              ? "grid-cols-1 md:grid-cols-3"
              : visibleColumns.length === 1
                ? "grid-cols-1"
                : "sm:grid-cols-3 xl:grid-cols-6"
          }`}
        >
          {visibleStageCounts.map((stage) => {
            const changed = changedStageKeys.includes(stage.key);

            return (
              <article
                key={stage.key}
                className={`rounded-2xl border p-4 transition-all duration-300 ${
                  changed
                    ? "scale-[1.02] border-gold/50 bg-gold/10 shadow-glow"
                    : "border-gray-200 bg-lacquer/50"
                }`}
              >
                <p className="text-xs uppercase tracking-[0.2em] text-smoke">
                  {t(`KITCHEN_COLUMN_${stage.key}`, stage.label)}
                </p>
                <p className="mt-2 font-display text-3xl text-gray-900">
                  {stage.count}
                </p>
                <p className="mt-1 text-xs text-smoke">
                  {t("KITCHEN_ORDERS_IN_STAGE", "Pedidos nesta etapa")}
                </p>
              </article>
            );
          })}
        </section>
      )}

      {showWaiterCalls && (
      <section className="mb-5 rounded-2xl border border-gold/20 bg-lacquer/60 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl text-gold">
              🛎 {t("KITCHEN_WAITER_CALLS_TITLE", "Chamadas de mesa")}
            </h2>
            <p className="mt-1 text-xs text-smoke">
              {t(
                "KITCHEN_WAITER_CALLS_DESC",
                "Pedidos recentes de atendimento enviados pelas mesas.",
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClearAlerts}
            className="rounded-full border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-smoke transition hover:border-gold/30 hover:text-gold"
          >
            {t("KITCHEN_CLEAR_WAITER_CALLS", "Limpar chamadas")}
            {waiterCalls.length ? ` (${waiterCalls.length})` : ""}
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {waiterCalls.map((call, index) => (
            <article
              key={`${call.mesaId ?? "mesa"}-${call.timestamp ?? index}`}
              className="rounded-2xl border border-gold/20 bg-ink/60 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg text-gray-900">
                    {call?.mesaNumber
                      ? t("KITCHEN_TABLE_NUMBER", "Mesa {{number}}").replace(
                          "{{number}}",
                          String(call.mesaNumber),
                        )
                      : t("KITCHEN_GENERIC_TABLE", "Mesa")}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gold">
                    {t("KITCHEN_SERVICE_REQUEST", "Atendimento solicitado")}
                  </p>
                </div>
                <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-smoke shadow-sm">
                  {formatRelativeTime(call?.timestamp)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleDismissWaiterCall(call, index)}
                className="mt-4 w-full rounded-2xl bg-green-600 px-4 py-3 text-sm font-black uppercase text-white transition hover:bg-green-700"
              >
                Dar baixa
              </button>
            </article>
          ))}
          {!waiterCalls.length ? (
            <div className="rounded-2xl border border-dashed border-gray-200 p-4 text-sm text-smoke md:col-span-2 xl:col-span-3">
              {t(
                "KITCHEN_WAITER_CALLS_EMPTY",
                "Nenhuma chamada de mesa registrada por enquanto.",
              )}
            </div>
          ) : null}
        </div>
      </section>
      )}

      {latestAlert ? (
        <div className="mb-4 flex items-center justify-between gap-4 rounded-2xl border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold">
          <div>
            <p className="font-semibold">
              {t(
                "KITCHEN_NEW_ORDER_ARRIVED",
                "Novo pedido {{id}} chegou na fila",
              ).replace(
                "{{id}}",
                `#${latestAlert.orderId.slice(-6).toUpperCase()}`,
              )}
            </p>
            <p className="text-xs text-gold/80">
              {t(
                "KITCHEN_HIGHLIGHT_SECONDS",
                "Destaque ativo por {{seconds}} segundos.",
              ).replace(
                "{{seconds}}",
                String(Math.floor(NEW_ORDER_HIGHLIGHT_MS / 1000)),
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLatestAlert(null)}
            className="rounded-xl border border-gold/30 px-3 py-2 text-xs font-semibold text-gold transition hover:bg-gold/10"
          >
            {t("BTN_CLOSE", "Fechar")}
          </button>
        </div>
      ) : null}

      {isLoading && (
        <div className="grid animate-pulse gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-48 rounded-2xl bg-gray-50" />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-sm text-red-300">
          {t("KITCHEN_LOAD_ERROR", "Falha ao carregar pedidos.")}
        </p>
      )}

      {/* Kanban columns */}
      {!isLoading && !isError && (
        <div
          className={`grid gap-6 ${
            visibleColumns.length === 3
              ? "grid-cols-1 lg:grid-cols-3"
              : visibleColumns.length === 1
                ? "grid-cols-1"
              : "sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-7"
          }`}
        >
          {visibleColumns.map((col) => {
            const isVirtual = col.virtual;
            const stageOrders = getColumnOrders(col.key).sort((a, b) =>
              compareOrdersByUrgency(a, b, currentNow),
            );
            const canDropHere = draggedOrder?.dropColumnKey === col.key;
            const isDropActive = activeDropStage === col.key && canDropHere;

            return (
              <section
                key={col.key}
                onDragOver={(event) => {
                  if (!canDropHere) return;
                  event.preventDefault();
                  setActiveDropStage(col.key);
                }}
                onDragLeave={() => {
                  if (activeDropStage === col.key) setActiveDropStage(null);
                }}
                onDrop={() => {
                  if (!draggedOrder || draggedOrder.dropColumnKey !== col.key) {
                    handleDragEnd();
                    return;
                  }
                  advance({
                    orderId: draggedOrder.id,
                    status: draggedOrder.nextStatus,
                  });
                  handleDragEnd();
                }}
                className={`rounded-3xl transition-all duration-200 ${
                  isDropActive
                    ? "bg-gold/10 ring-2 ring-gold/40"
                    : canDropHere
                      ? "ring-1 ring-dashed ring-gold/20"
                      : ""
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">
                    {t(`KITCHEN_COLUMN_${col.key}`, col.label)}
                  </h2>
                  <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs text-smoke">
                    {stageOrders.length}
                  </span>
                </div>

                {isDropActive ? (
                  <div className="mb-3 rounded-2xl border border-gold/40 bg-gold/10 px-3 py-2 text-center text-xs font-semibold text-gold">
                    {t(
                      "KITCHEN_DROP_TO_STAGE",
                      "Solte aqui para mover para {{stage}}",
                    ).replace(
                      "{{stage}}",
                      t(`KITCHEN_COLUMN_${col.key}`, col.label),
                    )}
                  </div>
                ) : null}

                <div className="space-y-3">
                  {stageOrders.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/15 p-4 text-center text-xs text-smoke">
                      {t("KITCHEN_NO_ORDER", "Nenhum pedido")}
                    </div>
                  ) : (
                    stageOrders.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        now={currentNow}
                        isFresh={freshOrderIds.includes(order.id)}
                        dragging={draggedOrder?.id === order.id}
                        advancing={
                          isPending && advancingVars?.orderId === order.id
                        }
                        onDragStart={isVirtual ? () => {} : handleDragStart}
                        onDragEnd={handleDragEnd}
                        onAdvance={(orderId, status) =>
                          advance({ orderId, status })
                        }
                        onConfirmPayment={
                          isVirtual && col.key === "AGUARDANDO_PAGAMENTO"
                            ? handleConfirmPayment
                            : undefined
                        }
                        onPayLater={
                          isVirtual && col.key === "AGUARDANDO_PAGAMENTO"
                            ? (orderId) =>
                                setPaymentStatus({
                                  orderId,
                                  paymentStatus: "PENDENTE",
                                  payLater: true,
                                })
                            : undefined
                        }
                        confirmingPayment={
                          isPaymentPending && paymentVars?.orderId === order.id
                        }
                        onCancel={cancelOrder}
                        cancelling={isCancelling && cancelVars === order.id}
                        motoboys={motoboys}
                        onAssignMotoboy={
                          !order.isPickup && !isInHouseOrder(order)
                            ? (orderId, motoboyId) =>
                                assignMotoboy({ orderId, motoboyId })
                            : undefined
                        }
                        assigningMotoboy={
                          isAssigning && assignVars?.orderId === order.id
                        }
                        onConfirmDelivery={
                          !order.isPickup && !isInHouseOrder(order)
                            ? (orderId, code) =>
                                confirmDelivery({ orderId, code })
                            : undefined
                        }
                        confirmingDelivery={
                          isConfirmingDelivery &&
                          deliveryConfirmVars?.orderId === order.id
                        }
                      />
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {!isLoading && !isError && orders.length === 0 && (
        <p className="mt-10 text-center text-smoke">
          {t("KITCHEN_NO_ACTIVE_ORDERS", "Sem pedidos ativos no momento.")}
        </p>
      )}
    </main>
  );
}

export default KitchenPage;
