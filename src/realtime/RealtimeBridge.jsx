import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { io } from "socket.io-client";
import {
  getDesktopNotificationsEnabled,
  showDesktopNotification,
} from "../lib/desktopNotifications.js";
import { useAuth } from "../hooks/useAuth.js";
import { incrementStaffUnreadCount } from "../lib/staffAlertsStore.js";
import { appendWaiterCall } from "../lib/waiterCallsStore.js";

const STAFF_ROLES = new Set(["ADMIN", "FUNCIONARIO", "ATENDENTE", "COZINHA"]);

function getSocketUrl() {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }

  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
  return apiUrl.replace(/\/api\/?$/, "");
}

function invalidateAdminQueries(queryClient) {
  queryClient.invalidateQueries({ queryKey: ["admin-orders-preview"] });
  queryClient.invalidateQueries({ queryKey: ["admin-sales-analytics"] });
}

function dispatchRealtimeEvent(eventName, payload) {
  window.dispatchEvent(
    new CustomEvent(eventName, {
      detail: payload,
    }),
  );
}

function ConnectionBadge({ status }) {
  const variants = {
    connecting: {
      dot: "bg-yellow-400",
      ring: "bg-yellow-400",
      label: "Conectando realtime",
      className: "border-yellow-500/30 bg-yellow-500/10 text-yellow-200",
    },
    connected: {
      dot: "bg-green-400",
      ring: "bg-green-400",
      label: "Realtime online",
      className: "border-green-500/30 bg-green-500/10 text-green-200",
    },
    disconnected: {
      dot: "bg-red-400",
      ring: "bg-red-400",
      label: "Realtime offline",
      className: "border-red-500/30 bg-red-500/10 text-red-200",
    },
  };

  const variant = variants[status] ?? variants.connecting;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] sm:bottom-6 sm:right-6">
      <div
        className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold shadow-glow backdrop-blur ${variant.className}`}
      >
        <span className="relative flex h-2.5 w-2.5">
          {status !== "disconnected" ? (
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${variant.ring}`}
            />
          ) : null}
          <span
            className={`relative inline-flex h-2.5 w-2.5 rounded-full ${variant.dot}`}
          />
        </span>
        <span>{variant.label}</span>
      </div>
    </div>
  );
}

export default function RealtimeBridge() {
  const queryClient = useQueryClient();
  const { token, user, isAuthenticated } = useAuth();
  const [connectionStatus, setConnectionStatus] = useState("connecting");
  const hasConnectedRef = useRef(false);
  const disconnectToastShownRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !token || !user) {
      hasConnectedRef.current = false;
      disconnectToastShownRef.current = false;
      return undefined;
    }

    const socket = io(getSocketUrl(), {
      auth: {
        token,
      },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    const onOrderCreated = (payload) => {
      if (user.role === "CLIENTE") {
        queryClient.invalidateQueries({ queryKey: ["my-orders"] });
        return;
      }

      if (user.role === "MESA") {
        // Atualiza imediatamente quando um pedido é criado nesta mesa
        queryClient.invalidateQueries({ queryKey: ["mesa-orders"] });
        return;
      }

      if (STAFF_ROLES.has(user.role)) {
        queryClient.invalidateQueries({ queryKey: ["kitchen-orders"] });
        queryClient.invalidateQueries({ queryKey: ["atendente-orders"] });
        queryClient.invalidateQueries({ queryKey: ["waiter-drink-orders"] });
        invalidateAdminQueries(queryClient);
        incrementStaffUnreadCount();
        dispatchRealtimeEvent("pc:order-created", payload);
        if (getDesktopNotificationsEnabled()) {
          showDesktopNotification("Novo pedido na fila", {
            body: `Pedido #${payload.orderId.slice(-6).toUpperCase()} aguardando atendimento.`,
            tag: `order-created-${payload.orderId}`,
          });
        }
        toast.success(
          `Novo pedido #${payload.orderId.slice(-6).toUpperCase()}`,
        );
      }
    };

    const onOrderStatusUpdated = (payload) => {
      if (user.role === "CLIENTE") {
        queryClient.invalidateQueries({ queryKey: ["my-orders"] });
        if (payload.waiterItemsDelivered) {
          return;
        }
        if (payload.status === "CANCELADO") {
          const msg = payload.paymentWasPending
            ? "Seu pedido foi cancelado: pagamento não recebido."
            : "Seu pedido foi cancelado.";
          toast.error(msg);
        } else {
          toast.success(
            `Seu pedido agora está em ${payload.status.replace(/_/g, " ")}`,
          );
        }
        return;
      }

      if (STAFF_ROLES.has(user.role)) {
        queryClient.invalidateQueries({ queryKey: ["kitchen-orders"] });
        queryClient.invalidateQueries({ queryKey: ["atendente-orders"] });
        queryClient.invalidateQueries({ queryKey: ["waiter-drink-orders"] });
        invalidateAdminQueries(queryClient);
        dispatchRealtimeEvent("pc:order-status-updated", payload);
      }
    };

    const onPaymentUpdated = () => {
      if (user.role === "CLIENTE") {
        queryClient.invalidateQueries({ queryKey: ["my-orders"] });
        return;
      }

      if (user.role === "MESA") {
        queryClient.invalidateQueries({ queryKey: ["mesa-orders"] });
        return;
      }

      if (STAFF_ROLES.has(user.role)) {
        invalidateAdminQueries(queryClient);
      }
    };

    const onChamarGarcom = (payload) => {
      if (!STAFF_ROLES.has(user.role)) {
        return;
      }

      appendWaiterCall(payload);
      incrementStaffUnreadCount();
      dispatchRealtimeEvent("pc:mesa-chamar-garcom", payload);

      const mesaLabel = payload?.mesaNumber
        ? `Mesa ${payload.mesaNumber}`
        : "Mesa";

      if (getDesktopNotificationsEnabled()) {
        showDesktopNotification("Chamar garçom", {
          body: `${mesaLabel} solicitou atendimento.`,
          tag: `mesa-chamar-garcom-${payload?.mesaId ?? Date.now()}`,
        });
      }

      toast.success(`${mesaLabel} solicitou atendimento`);
    };

    const onConnect = () => {
      setConnectionStatus("connected");

      if (hasConnectedRef.current && disconnectToastShownRef.current) {
        dispatchRealtimeEvent("pc:realtime-reconnected", { role: user.role });
        toast.success("Conexao em tempo real restabelecida");
      }

      hasConnectedRef.current = true;
      disconnectToastShownRef.current = false;
    };

    const onDisconnect = () => {
      setConnectionStatus("disconnected");

      if (hasConnectedRef.current && !disconnectToastShownRef.current) {
        toast.error(
          "Conexao em tempo real perdida. Usando fallback de atualizacao.",
        );
        disconnectToastShownRef.current = true;
      }
    };

    const onConnectError = () => {
      setConnectionStatus("disconnected");
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("order:created", onOrderCreated);
    socket.on("order:status-updated", onOrderStatusUpdated);
    socket.on("order:payment-updated", onPaymentUpdated);
    socket.on("mesa:chamar-garcom", onChamarGarcom);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("order:created", onOrderCreated);
      socket.off("order:status-updated", onOrderStatusUpdated);
      socket.off("order:payment-updated", onPaymentUpdated);
      socket.off("mesa:chamar-garcom", onChamarGarcom);
      socket.disconnect();
    };
  }, [isAuthenticated, queryClient, token, user]);

  if (!isAuthenticated) {
    return null;
  }

  return <ConnectionBadge status={connectionStatus} />;
}
