import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import EstimatedTimeBadge from "../components/EstimatedTimeBadge.jsx";
import {
  getDesktopNotificationsEnabled,
  requestDesktopNotificationPermission,
  setDesktopNotificationsEnabled,
  supportsDesktopNotifications,
} from "../lib/desktopNotifications.js";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { compareOrdersByUrgency, getOrderEta } from "../lib/orderEta.js";
import {
  clearStaffUnreadCount,
  getStaffUnreadCount,
  subscribeToStaffUnreadCount,
} from "../lib/staffAlertsStore.js";
import { useTranslation } from "../context/I18nContext.jsx";
import {
  clearWaiterCalls,
  getWaiterCalls,
  subscribeToWaiterCalls,
} from "../lib/waiterCallsStore.js";

const currency = (v) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "-";

function getPendingCustomerName(order) {
  return order.payment?.payload?.pendingCustomerName ?? "";
}

function getOrderOriginLabel(order) {
  if (order.mesa) return order.mesa.name ?? `Mesa ${order.mesa.number ?? ""}`;
  if (order.comanda) return `Comanda ${order.comanda.number}`;
  if (order.isPickup) return "Retirada";
  if (order.deliveryAddress) return "Entrega";
  return "Pedido";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function printPendingOrder(order) {
  const printWindow = window.open("", "_blank", "width=420,height=640");
  if (!printWindow) return;

  const customerName =
    getPendingCustomerName(order) ||
    order.user?.name ||
    order.comanda?.name ||
    getOrderOriginLabel(order);
  const itemsHtml = (order.items ?? [])
    .map(
      (item) => `
        <tr>
          <td>${escapeHtml(item.quantity)}x ${escapeHtml(
            item.product?.name ?? item.productName ?? "Item",
          )}</td>
          <td style="text-align:right">${currency(item.totalPrice)}</td>
        </tr>
      `,
    )
    .join("");

  printWindow.document.write(`
    <html>
      <head>
        <title>Pagamento pendente</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 18px; color: #111827; }
          h1 { font-size: 20px; margin: 0 0 8px; }
          p { margin: 4px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 14px; }
          td { border-bottom: 1px solid #e5e7eb; padding: 7px 0; font-size: 13px; }
          .total { margin-top: 16px; font-size: 20px; font-weight: 800; text-align: right; }
          .meta { font-size: 12px; color: #4b5563; }
        </style>
      </head>
      <body onload="window.print()">
        <h1>Pagamento pendente</h1>
        <p><strong>Cliente:</strong> ${escapeHtml(customerName)}</p>
        <p><strong>Origem:</strong> ${escapeHtml(getOrderOriginLabel(order))}</p>
        <p class="meta">Pedido #${order.id.slice(-6).toUpperCase()} - ${formatDateTime(order.createdAt)}</p>
        <table><tbody>${itemsHtml}</tbody></table>
        <div class="total">${currency(order.total)}</div>
      </body>
    </html>
  `);
  printWindow.document.close();
}

function PendingPaymentAdminItem({ order, t }) {
  const pendingCustomerName = getPendingCustomerName(order);

  return (
    <li className="rounded-xl border border-amber-400/40 bg-amber-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-amber-800">
            {pendingCustomerName || getOrderOriginLabel(order)}
          </p>
          {pendingCustomerName ? (
            <p className="mt-0.5 text-xs font-semibold text-amber-700">
              {getOrderOriginLabel(order)}
            </p>
          ) : null}
        </div>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
          {currency(order.total)}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-amber-700">
          #{order.id.slice(-6).toUpperCase()} ·{" "}
          {t(
            `PAYMENT_STATUS_${order.paymentStatus ?? "PENDENTE"}`,
            order.paymentStatus ?? "PENDENTE",
          )}
        </p>
        <button
          type="button"
          onClick={() => printPendingOrder(order)}
          className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-amber-700"
        >
          Imprimir
        </button>
      </div>
    </li>
  );
}

function AdminPanelPage() {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());
  const [unreadCount, setUnreadCount] = useState(() => getStaffUnreadCount());
  const [waiterCalls, setWaiterCalls] = useState(() => getWaiterCalls());
  const [desktopEnabled, setDesktopEnabled] = useState(() =>
    getDesktopNotificationsEnabled(),
  );

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => subscribeToStaffUnreadCount(setUnreadCount), []);
  useEffect(() => subscribeToWaiterCalls(setWaiterCalls), []);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-orders-preview"],
    queryFn: async () => {
      const response = await api.get("/orders");
      return response.data?.data || [];
    },
  });

  const { data: pendingPaymentData = [] } = useQuery({
    queryKey: ["caixa-pending-payments"],
    queryFn: async () =>
      (await api.get("/orders/pending-payments")).data?.data ?? [],
  });

  const currentNow = useMemo(() => new Date(now), [now]);

  // Pagamentos pendentes com detalhes para o painel administrativo.
  const pendingPaymentOrders = useMemo(() => {
    return pendingPaymentData.filter(
      (order) =>
        order.paymentStatus !== "APROVADO" && order.status !== "CANCELADO",
    );
  }, [pendingPaymentData]);

  const prioritizedOrders = useMemo(
    () =>
      [...(data ?? [])]
        .sort((firstOrder, secondOrder) =>
          compareOrdersByUrgency(firstOrder, secondOrder, currentNow),
        )
        .slice(0, 5),
    [currentNow, data],
  );
  const overdueCount = useMemo(
    () =>
      (data ?? []).filter((order) => getOrderEta(order, currentNow)?.isOverdue)
        .length,
    [currentNow, data],
  );
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

  const handleClearAlerts = () => {
    clearStaffUnreadCount();
    clearWaiterCalls();
  };

  const formatRelativeTime = (timestamp) => {
    if (!timestamp) {
      return t("ADMIN_PANEL_JUST_NOW_JUDIMAR", "agora");
    }

    const diffMinutes = Math.max(
      0,
      Math.floor((now - new Date(timestamp).getTime()) / 60000),
    );

    if (diffMinutes < 1) {
      return t("ADMIN_PANEL_JUST_NOW_JUDIMAR", "agora");
    }

    if (diffMinutes === 1) {
      return t("ADMIN_PANEL_ONE_MINUTE_AGO_JUDIMAR", "há 1 min");
    }

    return t("ADMIN_PANEL_MINUTES_AGO_JUDIMAR", "há {{count}} min").replace(
      "{{count}}",
      String(diffMinutes),
    );
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-6 text-gray-900 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-gold">
            {t("ADMIN_PANEL_TITLE_JUDIMAR", "Painel Admin")}
          </h1>
          <p className="mt-1 text-sm text-smoke">
            {t(
              "ADMIN_PANEL_SUBTITLE_JUDIMAR",
              "Visão operacional para equipe do Judimar.",
            )}
          </p>
        </div>
        <Link
          to="/"
          className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-500 transition hover:border-gray-400 hover:text-gray-800"
        >
          {t("ADMIN_PANEL_BACK_HOME_JUDIMAR", "← Início")}
        </Link>
      </div>

      {/* Status bar */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        {overdueCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-400/40 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-400" />
            </span>
            {t(
              "ADMIN_PANEL_OVERDUE_COUNT_JUDIMAR",
              "{{count}} pedidos em atraso",
            ).replace("{{count}}", String(overdueCount))}
          </span>
        )}
        {overdueCount === 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-green-400/30 bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-400">
            ✓ {t("ADMIN_PANEL_NO_DELAYS_JUDIMAR", "Sem atrasos")}
          </span>
        )}
        {unreadCount > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs font-semibold text-gold">
            🔔{" "}
            {t("ADMIN_PANEL_ALERTS_COUNT_JUDIMAR", "{{count}} alertas").replace(
              "{{count}}",
              String(unreadCount),
            )}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1 text-xs text-smoke">
          🖥{" "}
          {desktopEnabled
            ? t("ADMIN_PANEL_DESKTOP_ON_JUDIMAR", "Notificações ativas")
            : t("ADMIN_PANEL_DESKTOP_OFF_JUDIMAR", "Notificações inativas")}
        </span>
      </div>

      {/* Quick action cards */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        <Link
          to="/admin/produtos"
          className="group flex items-start gap-4 rounded-2xl border border-gold/20 bg-lacquer/70 p-5 transition hover:border-gold/50 hover:shadow-md"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-2xl">
            🍔
          </span>
          <div>
            <h2 className="font-semibold text-gray-900 group-hover:text-gold">
              {t(
                "ADMIN_PANEL_CARD_PRODUCTS_TITLE_JUDIMAR",
                "Gerenciar Produtos",
              )}
            </h2>
            <p className="mt-0.5 text-xs text-smoke">
              {t(
                "ADMIN_PANEL_CARD_PRODUCTS_DESC_JUDIMAR",
                "Cadastrar, editar e desativar itens do cardápio",
              )}
            </p>
          </div>
        </Link>

        <Link
          to="/admin/vendas"
          className="group flex items-start gap-4 rounded-2xl border border-gold/20 bg-lacquer/70 p-5 transition hover:border-gold/50 hover:shadow-md"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green-500/15 text-2xl">
            📈
          </span>
          <div>
            <h2 className="font-semibold text-gray-900 group-hover:text-gold">
              {t("ADMIN_PANEL_CARD_SALES_TITLE_JUDIMAR", "Análise de Vendas")}
            </h2>
            <p className="mt-0.5 text-xs text-smoke">
              {t(
                "ADMIN_PANEL_CARD_SALES_DESC_JUDIMAR",
                "Receita, ticket médio e itens mais vendidos",
              )}
            </p>
          </div>
        </Link>

        <Link
          to="/cozinha"
          className="group flex items-start gap-4 rounded-2xl border border-gold/20 bg-lacquer/70 p-5 transition hover:border-gold/50 hover:shadow-md"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-yellow-500/15 text-2xl">
            👨‍🍳
          </span>
          <div>
            <h2 className="font-semibold text-gray-900 group-hover:text-gold">
              {t("ADMIN_PANEL_CARD_KITCHEN_TITLE_JUDIMAR", "Painel da Cozinha")}
            </h2>
            <p className="mt-0.5 text-xs text-smoke">
              {t(
                "ADMIN_PANEL_CARD_KITCHEN_DESC_JUDIMAR",
                "Ver pedidos ativos e avançar status",
              )}
            </p>
          </div>
        </Link>

        <Link
          to="/admin/historico"
          className="group flex items-start gap-4 rounded-2xl border border-gold/20 bg-lacquer/70 p-5 transition hover:border-gold/50 hover:shadow-md"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-2xl">
            📋
          </span>
          <div>
            <h2 className="font-semibold text-gray-900 group-hover:text-gold">
              {t(
                "ADMIN_PANEL_CARD_HISTORY_TITLE_JUDIMAR",
                "Histórico de Pedidos",
              )}
            </h2>
            <p className="mt-0.5 text-xs text-smoke">
              {t(
                "ADMIN_PANEL_CARD_HISTORY_DESC_JUDIMAR",
                "Todos os pedidos, cancelamentos e estornos",
              )}
            </p>
          </div>
        </Link>

        <Link
          to="/admin/usuarios"
          className="group flex items-start gap-4 rounded-2xl border border-gold/20 bg-lacquer/70 p-5 transition hover:border-gold/50 hover:shadow-md"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-500/15 text-2xl">
            👤
          </span>
          <div>
            <h2 className="font-semibold text-gray-900 group-hover:text-gold">
              {t("ADMIN_PANEL_CARD_USERS_TITLE_JUDIMAR", "Criar Usuário")}
            </h2>
            <p className="mt-0.5 text-xs text-smoke">
              {t(
                "ADMIN_PANEL_CARD_USERS_DESC_JUDIMAR",
                "Cadastrar motoboy, cozinha, funcionário ou admin",
              )}
            </p>
          </div>
        </Link>

        <Link
          to="/admin/cardapio-mesa"
          className="group flex items-start gap-4 rounded-2xl border border-gold/20 bg-lacquer/70 p-5 transition hover:border-gold/50 hover:shadow-md"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pink-500/15 text-2xl">
            📱
          </span>
          <div>
            <h2 className="font-semibold text-gray-900 group-hover:text-gold">
              {t("ADMIN_PANEL_CARD_MESA_MENU_TITLE", "Cardápio Mesa")}
            </h2>
            <p className="mt-0.5 text-xs text-smoke">
              {t(
                "ADMIN_PANEL_CARD_MESA_MENU_DESC",
                "Gerar QR codes para o cardápio de mesa e imprimir no restaurante",
              )}
            </p>
          </div>
        </Link>

        <Link
          to="/comandas"
          className="group flex items-start gap-4 rounded-2xl border border-gold/20 bg-lacquer/70 p-5 transition hover:border-gold/50 hover:shadow-md"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-2xl">
            🎫
          </span>
          <div>
            <h2 className="font-semibold text-gray-900 group-hover:text-gold">
              Comandas
            </h2>
            <p className="mt-0.5 text-xs text-smoke">
              Criar comandas, gerar QR e consultar valores em aberto
            </p>
          </div>
        </Link>

        <Link
          to="/caixa"
          className="group flex items-start gap-4 rounded-2xl border border-gold/20 bg-lacquer/70 p-5 transition hover:border-gold/50 hover:shadow-md"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-500/15 text-2xl">
            R$
          </span>
          <div>
            <h2 className="font-semibold text-gray-900 group-hover:text-gold">
              Caixa
            </h2>
            <p className="mt-0.5 text-xs text-smoke">
              Baixar pagamentos pendentes de mesas, comandas e entregas
            </p>
          </div>
        </Link>
      </div>

      {isLoading ? (
        <p className="mt-6 text-sm text-smoke">
          {t("ADMIN_PANEL_LOADING_JUDIMAR", "Carregando dados...")}
        </p>
      ) : null}
      {isError ? (
        <p className="mt-6 text-sm text-red-300">
          {t(
            "ADMIN_PANEL_LOAD_ERROR_JUDIMAR",
            "Falha ao carregar dados do painel.",
          )}
        </p>
      ) : null}

      <section className="mt-6 rounded-3xl border border-secondary/20 bg-lacquer/70 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl text-primary">
              🔔{" "}
              {t("ADMIN_PANEL_WAITER_CALLS_TITLE_JUDIMAR", "Chamadas de Mesa")}
            </h2>
            <p className="mt-1 text-xs text-smoke">
              {t(
                "ADMIN_PANEL_WAITER_CALLS_DESC_JUDIMAR",
                "Solicitações recentes de atendimento enviadas pelas mesas.",
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClearAlerts}
            className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-smoke transition hover:border-secondary/30 hover:text-secondary"
          >
            {t("ADMIN_PANEL_CLEAR_WAITER_CALLS_JUDIMAR", "Limpar chamadas")}
            {waiterCalls.length ? ` (${waiterCalls.length})` : ""}
          </button>
        </div>

        <ul className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {waiterCalls.map((call, index) => (
            <li
              key={`${call.mesaId ?? "mesa"}-${call.timestamp ?? index}`}
              className="rounded-2xl border border-secondary/15 bg-accent/60 p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-lg text-primary">
                    {call?.mesaNumber
                      ? t(
                          "ADMIN_PANEL_TABLE_NUMBER_JUDIMAR",
                          "Mesa {{number}}",
                        ).replace("{{number}}", String(call.mesaNumber))
                      : t("ADMIN_PANEL_GENERIC_TABLE_JUDIMAR", "Mesa")}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.2em] text-secondary">
                    {t(
                      "ADMIN_PANEL_SERVICE_REQUEST_JUDIMAR",
                      "Atendimento solicitado",
                    )}
                  </p>
                </div>
                <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-text-muted shadow-sm">
                  {formatRelativeTime(call?.timestamp)}
                </span>
              </div>
            </li>
          ))}
          {!waiterCalls.length ? (
            <li className="rounded-2xl border border-dashed border-border-soft bg-accent/40 p-4 text-sm text-smoke md:col-span-2 xl:col-span-3">
              {t(
                "ADMIN_PANEL_WAITER_CALLS_EMPTY_JUDIMAR",
                "Nenhuma chamada de mesa registrada por enquanto.",
              )}
            </li>
          ) : null}
        </ul>
      </section>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {/* Fila Prioritária */}
        <section className="rounded-3xl border border-gold/20 bg-lacquer/70 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-xl text-gold">
              🔥{" "}
              {t(
                "ADMIN_PANEL_PRIORITY_QUEUE_TITLE_JUDIMAR",
                "Fila Prioritária",
              )}
            </h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDesktopToggle}
                className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                  desktopEnabled
                    ? "border-gold/30 text-gold hover:bg-gold/10"
                    : "border-gray-200 text-smoke hover:border-gold/30 hover:text-gold"
                }`}
              >
                🖥{" "}
                {desktopEnabled
                  ? t("ADMIN_PANEL_DESKTOP_BUTTON_ON_JUDIMAR", "ligado")
                  : t("ADMIN_PANEL_DESKTOP_BUTTON_OFF_JUDIMAR", "desligado")}
              </button>
              <button
                type="button"
                onClick={handleClearAlerts}
                className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-smoke transition hover:border-gold/30 hover:text-gold"
              >
                {t("ADMIN_PANEL_MARK_ALERTS_READ_JUDIMAR", "Limpar alertas")}
                {unreadCount ? ` (${unreadCount})` : ""}
              </button>
            </div>
          </div>
          <ul className="mt-4 space-y-3 text-sm">
            {prioritizedOrders.map((order) => (
              <li
                key={order.id}
                className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${
                  getOrderEta(order, currentNow)?.isOverdue
                    ? "border-red-500/40 bg-red-500/5"
                    : "border-gray-200 bg-gray-50"
                }`}
              >
                <div>
                  <p className="font-semibold text-gray-900">
                    #{order.id.slice(-6).toUpperCase()}
                  </p>
                  <p className="mt-0.5 text-xs text-smoke">
                    {t(`ORDER_STATUS_${order.status}`, order.status)}
                  </p>
                </div>
                <EstimatedTimeBadge compact now={currentNow} order={order} />
              </li>
            ))}
            {!prioritizedOrders.length && !isLoading ? (
              <li className="text-sm text-smoke">
                {t(
                  "ADMIN_PANEL_NO_ORDERS_JUDIMAR",
                  "Sem pedidos ativos no momento.",
                )}
              </li>
            ) : null}
          </ul>
        </section>

        {/* Mesas e comandas com pagamento pendente */}
        <section className="rounded-3xl border border-amber-400/30 bg-lacquer/70 p-4 sm:p-6">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl text-amber-500">
              💳{" "}
              {t(
                "ADMIN_PANEL_PENDING_PAYMENTS_TITLE_JUDIMAR",
                "Pagamentos Pendentes",
              )}
            </h2>
            {pendingPaymentOrders.length > 0 && (
              <span className="animate-pulse rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
                {pendingPaymentOrders.length}
              </span>
            )}
          </div>
          <ul className="mt-4 space-y-3 text-sm">
            {pendingPaymentOrders.map((order) => (
              <PendingPaymentAdminItem key={order.id} order={order} t={t} />
            ))}
            {!pendingPaymentOrders.length && !isLoading ? (
              <li className="text-sm text-smoke">
                {t(
                  "ADMIN_PANEL_NO_PENDING_PAYMENTS_JUDIMAR",
                  "Nenhum pagamento pendente.",
                )}
              </li>
            ) : null}
          </ul>
        </section>
      </div>
    </main>
  );
}

export default AdminPanelPage;
