import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import { useNavigate } from "react-router-dom";
import EstimatedTimeBadge from "../components/EstimatedTimeBadge.jsx";
import OrderTracker from "../components/OrderTracker.jsx";
import { useCart } from "../context/CartContext.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { api } from "../lib/api.js";
import { useTranslation } from "../context/I18nContext.jsx";

const PIZZARIA_WHATSAPP = import.meta.env.VITE_PIZZARIA_WHATSAPP ?? "";

function buildWhatsAppUrl(order, userName, t) {
  const shortId = `#${order.id.slice(-6).toUpperCase()}`;
  const date = new Date(order.createdAt).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const itemLines = (order.items ?? [])
    .map((item) => `  - ${item.productName ?? "Item"} x${item.quantity}`)
    .join("\n");
  const msg = t(
    "CLIENT_DASHBOARD_CANCELLED_WHATSAPP",
    `Olá! Sou ${userName}.\nMeu pedido ${shortId} feito em ${date} com os itens:\n${itemLines}\nfoi cancelado. Gostaria de entender o motivo.`,
  );
  const base = PIZZARIA_WHATSAPP
    ? `https://wa.me/${PIZZARIA_WHATSAPP.replace(/\D/g, "")}`
    : "https://wa.me";
  return `${base}?text=${encodeURIComponent(msg)}`;
}

const STATUS_FILTERS = [
  { id: "TODOS", label: "Todos" },
  { id: "RECEBIDO", label: "Recebido" },
  { id: "PREPARANDO", label: "Preparando" },
  { id: "PRONTO", label: "Pronto" },
  { id: "SAIU_PARA_ENTREGA", label: "Saiu p/ Entrega" },
  { id: "ENTREGUE", label: "Entregue" },
  { id: "CANCELADO", label: "Cancelado" },
];

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function ClientDashboardPage() {
  const { t, locale } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItems, openCart } = useCart();
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState("TODOS");
  const [expandedId, setExpandedId] = useState(null);
  const [now, setNow] = useState(() => Date.now());
  const [deletingId, setDeletingId] = useState(null);

  const statusLabel = (id) =>
    id === "TODOS"
      ? t("CLIENT_DASHBOARD_FILTER_ALL", "Todos")
      : t(`ORDER_STATUS_${id}`, id.replace(/_/g, " "));

  const deleteMutation = useMutation({
    mutationFn: (orderId) => api.delete(`/orders/${orderId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-orders"] });
      setDeletingId(null);
    },
    onError: () => setDeletingId(null),
  });

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const {
    data: orders = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["my-orders"],
    queryFn: async () => {
      const response = await api.get("/orders/me");
      return response.data?.data || [];
    },
  });

  const filtered =
    activeFilter === "TODOS"
      ? orders
      : orders.filter((o) => o.status === activeFilter);

  const handleRepeatOrder = (order) => {
    const cartItems = (order.items ?? [])
      .map((item) => {
        if (!item.productId) return null;
        return {
          key: `${item.productId}-${Date.now()}`,
          nome: item.productName ?? "Item",
          price: Number(item.unitPrice ?? 0),
          addons: [],
          removals: [],
          observation: item.notes ?? "",
          quantity: Number(item.quantity ?? 1),
          payload: {
            productId: item.productId,
            addonIds: [],
            removedIngredients: "",
          },
        };
      })
      .filter(Boolean);

    if (!cartItems.length) {
      toast.error(
        t(
          "CLIENT_DASHBOARD_REPEAT_ERROR",
          "Nao foi possivel repetir este pedido.",
        ),
      );
      return;
    }

    addItems(cartItems, { silent: true });
    toast.success(
      t(
        "CLIENT_DASHBOARD_REPEAT_SUCCESS",
        "Pedido adicionado novamente ao carrinho.",
      ),
    );
    openCart();
    navigate("/cardapio");
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-6 text-gray-900 sm:px-6">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-3xl text-gold">
          {t("CLIENT_DASHBOARD_HELLO", "Ola")},{" "}
          {user?.name?.split(" ")[0] || t("CLIENT_DASHBOARD_CLIENT", "Cliente")}
        </h1>
        <Link
          className="rounded-xl border border-gray-200 px-3 py-2 text-sm transition hover:border-gold/40"
          to="/"
        >
          {t("BTN_BACK", "Voltar")}
        </Link>
      </header>

      {/* Filter bar */}
      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setActiveFilter(f.id)}
            className={`shrink-0 rounded-2xl border px-4 py-2 text-xs font-semibold transition-all duration-200 ${
              activeFilter === f.id
                ? "border-gold bg-gold/15 text-gold"
                : "border-gray-200 bg-gray-50 text-smoke hover:border-gold/30"
            }`}
          >
            {statusLabel(f.id)}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading && (
        <div className="mt-6 animate-pulse space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 rounded-2xl bg-gray-50" />
          ))}
        </div>
      )}

      {isError && (
        <p className="mt-6 text-sm text-red-300">
          {t("CLIENT_DASHBOARD_LOAD_ERROR", "Erro ao carregar pedidos.")}
        </p>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <p className="mt-6 rounded-2xl border border-gray-200 bg-gray-100 p-4 text-sm text-smoke">
          {activeFilter === "TODOS"
            ? t("CLIENT_DASHBOARD_EMPTY_ALL", "Voce ainda nao possui pedidos.")
            : t(
                "CLIENT_DASHBOARD_EMPTY_FILTER",
                'Nenhum pedido com status "{{status}}".',
              ).replace("{{status}}", statusLabel(activeFilter))}
        </p>
      )}

      <div className="mt-6 space-y-4">
        {filtered.map((order) => {
          const isExpanded = expandedId === order.id;
          return (
            <div
              key={order.id}
              className="rounded-3xl border border-gold/20 bg-lacquer/70 shadow-glow transition-all duration-300"
            >
              {/* Order header — always visible */}
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : order.id)}
                className="flex w-full items-center justify-between px-5 py-4 text-left"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {t("CLIENT_DASHBOARD_ORDER_PREFIX", "Pedido")} #
                    {order.id.slice(-6).toUpperCase()}
                  </p>
                  <p className="mt-0.5 text-xs text-smoke">
                    {formatDate(order.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <EstimatedTimeBadge
                    compact
                    now={new Date(now)}
                    order={order}
                  />
                  <span
                    className={`rounded-xl px-3 py-1 text-xs font-bold ${
                      order.status === "CANCELADO"
                        ? "bg-red-500/10 text-red-400"
                        : "bg-gold/10 text-gold"
                    }`}
                  >
                    {t(
                      `ORDER_STATUS_${order.status}`,
                      order.status.replace(/_/g, " "),
                    )}
                  </span>
                  <span className="text-sm font-bold text-gold">
                    {Number(order.total).toLocaleString(locale || "pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </span>
                  <svg
                    className={`h-4 w-4 text-smoke transition-transform duration-300 ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </button>

              {/* Expanded details */}
              <div
                className={`overflow-hidden transition-all duration-300 ${
                  isExpanded ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
                }`}
              >
                <div className="border-t border-gray-200 px-5 pb-5 pt-4">
                  <EstimatedTimeBadge now={new Date(now)} order={order} />

                  <OrderTracker status={order.status} />

                  {/* Delivery code — shown while order is out for delivery */}
                  {order.deliveryCode &&
                    order.status === "SAIU_PARA_ENTREGA" &&
                    !order.isPickup && (
                      <div className="mt-4 rounded-2xl border-2 border-amber-400/60 bg-amber-50 px-4 py-3 text-center">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-amber-700">
                          {t(
                            "CLIENT_DASHBOARD_DELIVERY_CODE_LABEL",
                            "Código de confirmação de entrega",
                          )}
                        </p>
                        <p className="font-display text-4xl font-bold tracking-[0.3em] text-amber-800">
                          {order.deliveryCode}
                        </p>
                        <p className="mt-1 text-[11px] text-amber-600">
                          {t(
                            "CLIENT_DASHBOARD_DELIVERY_CODE_HINT",
                            "Informe este código ao motoboy para confirmar o recebimento",
                          )}
                        </p>
                      </div>
                    )}

                  <div className="mt-4 space-y-2">
                    {order.items?.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start justify-between rounded-xl bg-gray-50 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-semibold">
                            {item.productName ??
                              t("CLIENT_DASHBOARD_ITEM", "Item")}
                          </p>
                          {item.notes && (
                            <p className="text-xs text-smoke">{item.notes}</p>
                          )}
                          <p className="text-xs text-smoke">{item.quantity}x</p>
                        </div>
                        <span className="text-sm text-gold">
                          {Number(item.unitPrice).toLocaleString(
                            locale || "pt-BR",
                            {
                              style: "currency",
                              currency: "BRL",
                            },
                          )}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex justify-between border-t border-gray-200 pt-3 text-sm">
                    <span className="text-smoke">
                      {t("CLIENT_DASHBOARD_PAYMENT", "Pagamento")}
                    </span>
                    <span
                      className={
                        order.paymentStatus === "APROVADO"
                          ? "text-green-400"
                          : "text-yellow-400"
                      }
                    >
                      {t(
                        `PAYMENT_STATUS_${order.paymentStatus}`,
                        order.paymentStatus,
                      )}
                    </span>
                  </div>

                  {order.deliveryAddress && (
                    <p className="mt-2 text-xs text-smoke">
                      {t("CLIENT_DASHBOARD_DELIVERY", "Entrega")}:{" "}
                      {order.deliveryAddress}
                    </p>
                  )}

                  {order.status !== "CANCELADO" ? (
                    <button
                      type="button"
                      onClick={() => handleRepeatOrder(order)}
                      className="mt-4 w-full rounded-2xl border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-semibold text-gold transition hover:bg-gold/20"
                    >
                      {t("CLIENT_DASHBOARD_REPEAT_ORDER", "Repetir pedido")}
                    </button>
                  ) : null}

                  {order.status === "CANCELADO" && (
                    <div className="mt-4 flex gap-2">
                      <a
                        href={buildWhatsAppUrl(
                          order,
                          user?.name ?? t("CLIENT_DASHBOARD_CLIENT", "Cliente"),
                          t,
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-green-400/40 bg-green-50 px-4 py-2 text-sm font-semibold text-green-600 transition hover:bg-green-100"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          className="h-4 w-4 fill-green-500"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                        {t("CLIENT_DASHBOARD_ASK_REASON", "Perguntar motivo")}
                      </a>
                      {deletingId === order.id ? (
                        <div className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2">
                          <span className="text-xs text-smoke">
                            {t("CLIENT_DASHBOARD_CONFIRM", "Confirmar?")}
                          </span>
                          <button
                            type="button"
                            onClick={() => deleteMutation.mutate(order.id)}
                            disabled={deleteMutation.isPending}
                            className="rounded-xl bg-red-500 px-3 py-1 text-xs font-bold text-white hover:bg-red-600 disabled:opacity-50"
                          >
                            {t("YES", "Sim")}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingId(null)}
                            className="rounded-xl border border-gray-200 px-3 py-1 text-xs font-semibold hover:bg-gray-100"
                          >
                            {t("NO", "Não")}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeletingId(order.id)}
                          className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-100"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                          {t("DELETE", "Excluir")}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}

export default ClientDashboardPage;
