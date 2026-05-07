import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import toast from "react-hot-toast";
import { useTranslation } from "../context/I18nContext.jsx";

const STATUS_CLASS = {
  RECEBIDO: "bg-blue-100 text-blue-700",
  PREPARANDO: "bg-yellow-100 text-yellow-700",
  PRONTO: "bg-orange-100 text-orange-700",
  SAIU_PARA_ENTREGA: "bg-green-100 text-green-700",
  ENTREGUE: "bg-gray-200 text-gray-700",
  CANCELADO: "bg-red-100 text-red-700",
};

const PAYMENT_CLASS = {
  PENDENTE: "bg-amber-100 text-amber-700",
  APROVADO: "bg-green-100 text-green-700",
  RECUSADO: "bg-red-100 text-red-700",
  ESTORNADO: "bg-purple-100 text-purple-700",
};

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function AdminOrderHistoryPage() {
  const { t, locale } = useTranslation();
  const queryClient = useQueryClient();
  const [clientName, setClientName] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [showOnlyRefund, setShowOnlyRefund] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);

  const { data: allClients = [] } = useQuery({
    queryKey: ["admin-clients"],
    queryFn: async () => {
      const res = await api.get("/admin/clients");
      return res.data?.data ?? [];
    },
    staleTime: 60_000,
  });

  const suggestions = useMemo(() => {
    if (!clientName.trim()) return [];
    const lower = clientName.toLowerCase();
    return allClients.filter((c) => c.name.toLowerCase().includes(lower));
  }, [clientName, allClients]);

  const queryParams = new URLSearchParams();
  if (appliedFilters.clientName)
    queryParams.set("clientName", appliedFilters.clientName);
  if (appliedFilters.dateFrom)
    queryParams.set("dateFrom", appliedFilters.dateFrom);
  if (appliedFilters.dateTo) queryParams.set("dateTo", appliedFilters.dateTo);

  const {
    data: orders = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["admin-order-history", appliedFilters],
    queryFn: async () => {
      const res = await api.get(
        `/admin/orders/history?${queryParams.toString()}`,
      );
      return res.data?.data ?? [];
    },
  });

  const needsRefund = useMemo(
    () =>
      orders.filter(
        (o) => o.status === "CANCELADO" && o.paymentStatus === "APROVADO",
      ),
    [orders],
  );

  const displayed = showOnlyRefund ? needsRefund : orders;

  const handleApply = () => {
    setAppliedFilters({ clientName, dateFrom, dateTo });
  };

  const handleClear = () => {
    setClientName("");
    setDateFrom("");
    setDateTo("");
    setAppliedFilters({});
    setShowOnlyRefund(false);
  };

  const {
    mutate: markAsPaid,
    variables: payingId,
    isPending: isPaying,
  } = useMutation({
    mutationFn: async (orderId) => {
      await api.patch(`/orders/${orderId}/payment-status`, {
        paymentStatus: "APROVADO",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-order-history"] });
      toast.success(
        t("ADMIN_HISTORY_PAYMENT_MARKED", "Pagamento marcado como aprovado"),
      );
    },
    onError: () =>
      toast.error(
        t("ADMIN_HISTORY_PAYMENT_UPDATE_ERROR", "Falha ao atualizar pagamento"),
      ),
  });

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-6 text-gray-900 sm:px-6">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-gold">
            {t("ADMIN_HISTORY_TITLE", "Histórico de Pedidos")}
          </h1>
          <p className="mt-1 text-sm text-smoke">
            {t(
              "ADMIN_HISTORY_SUBTITLE",
              "Todos os pedidos — entregues, cancelados e em andamento.",
            )}
          </p>
        </div>
        <Link
          to="/admin"
          className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-500 transition hover:border-gray-400 hover:text-gray-800"
        >
          {t("ADMIN_HISTORY_BACK", "← Admin")}
        </Link>
      </div>

      {/* Refund alert banner */}
      {needsRefund.length > 0 && (
        <div className="mb-5 flex items-center justify-between gap-4 rounded-2xl border border-red-300 bg-red-50 px-4 py-3">
          <div>
            <p className="font-semibold text-red-700">
              ⚠️ {needsRefund.length}{" "}
              {needsRefund.length === 1
                ? t(
                    "ADMIN_HISTORY_REFUND_NEEDS_SINGLE",
                    "pedido cancelado precisa de estorno",
                  )
                : t(
                    "ADMIN_HISTORY_REFUND_NEEDS_MULTI",
                    "pedidos cancelados precisam de estorno",
                  )}
            </p>
            <p className="mt-0.5 text-xs text-red-600">
              {t(
                "ADMIN_HISTORY_REFUND_HINT",
                "O cliente já havia pago e o pagamento foi aprovado.",
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowOnlyRefund((v) => !v)}
            className={`shrink-0 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
              showOnlyRefund
                ? "border-red-400 bg-red-200 text-red-800"
                : "border-red-300 bg-white text-red-700 hover:bg-red-100"
            }`}
          >
            {showOnlyRefund
              ? t("ADMIN_HISTORY_SHOW_ALL", "Ver todos")
              : t("ADMIN_HISTORY_SHOW_REFUNDS", "Ver só estornos")}
          </button>
        </div>
      )}

      {/* Filters */}
      <section className="mb-5 rounded-2xl border border-gray-200 bg-white p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-smoke">
          {t("ADMIN_HISTORY_FILTERS", "Filtros")}
        </p>
        <div className="flex flex-wrap gap-3">
          {/* Client name with autocomplete */}
          <div className="relative flex-1 min-w-[180px]">
            <input
              ref={inputRef}
              type="text"
              placeholder={t("ADMIN_HISTORY_CLIENT_NAME", "Nome do cliente")}
              value={clientName}
              autoComplete="off"
              onChange={(e) => {
                setClientName(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setShowSuggestions(false);
                  handleApply();
                }
                if (e.key === "Escape") setShowSuggestions(false);
              }}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gold/50 focus:outline-none"
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul className="absolute left-0 top-full z-20 mt-1 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
                {suggestions.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onMouseDown={() => {
                        setClientName(c.name);
                        setShowSuggestions(false);
                      }}
                      className="w-full px-4 py-2.5 text-left text-sm text-gray-900 hover:bg-gold/10 hover:text-gold"
                    >
                      {c.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-smoke">
              {t("ADMIN_HISTORY_FROM", "De")}
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gold/50 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-smoke">
              {t("ADMIN_HISTORY_TO", "Até")}
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gold/50 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={handleApply}
            className="rounded-xl bg-gold px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            {t("ADMIN_HISTORY_FILTER", "Filtrar")}
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-500 transition hover:border-gray-400"
          >
            {t("ADMIN_HISTORY_CLEAR", "Limpar")}
          </button>
        </div>
      </section>

      {/* Summary */}
      {!isLoading && !isError && (
        <p className="mb-3 text-xs text-smoke">
          {displayed.length}{" "}
          {displayed.length === 1
            ? t("ADMIN_HISTORY_FOUND_SINGLE", "pedido encontrado")
            : t("ADMIN_HISTORY_FOUND_MULTI", "pedidos encontrados")}
          {showOnlyRefund
            ? t(
                "ADMIN_HISTORY_ONLY_REFUNDS_SUFFIX",
                " — mostrando apenas estornos pendentes",
              )
            : ""}
        </p>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3 animate-pulse">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-gray-100" />
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {t(
            "ADMIN_HISTORY_LOAD_ERROR",
            "Erro ao carregar histórico de pedidos.",
          )}
        </p>
      )}

      {/* Empty */}
      {!isLoading && !isError && displayed.length === 0 && (
        <p className="rounded-2xl border border-gray-200 bg-gray-50 p-6 text-center text-sm text-smoke">
          {t("ADMIN_HISTORY_EMPTY", "Nenhum pedido encontrado.")}
        </p>
      )}

      {/* Orders list */}
      <div className="space-y-3">
        {displayed.map((order) => {
          const isExpanded = expandedId === order.id;
          const needsRefundFlag =
            order.status === "CANCELADO" && order.paymentStatus === "APROVADO";

          return (
            <div
              key={order.id}
              className={`rounded-2xl border transition-all duration-200 ${
                needsRefundFlag
                  ? "border-red-300 bg-red-50"
                  : order.paymentStatus === "PENDENTE" &&
                      order.status !== "CANCELADO"
                    ? "border-amber-300 bg-amber-50/40"
                    : "border-gray-200 bg-white"
              }`}
            >
              {/* Row header */}
              <div className="flex w-full items-center gap-3 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                  className="flex flex-1 items-center justify-between gap-3 text-left min-w-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="shrink-0 text-xs font-bold text-gray-500 uppercase tracking-wide">
                      #{order.id.slice(-6).toUpperCase()}
                    </span>
                    <span className="truncate text-sm font-semibold text-gray-900">
                      {order.user?.name ?? "—"}
                    </span>
                    {needsRefundFlag && (
                      <span className="shrink-0 rounded-full bg-red-200 px-2 py-0.5 text-[10px] font-bold text-red-800">
                        {t("ADMIN_HISTORY_REFUND_PENDING", "ESTORNO PENDENTE")}
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="hidden text-xs text-smoke sm:block">
                      {formatDate(order.createdAt)}
                    </span>
                    <span
                      className={`rounded-xl px-2 py-1 text-xs font-bold ${STATUS_CLASS[order.status] ?? "bg-gray-100 text-gray-700"}`}
                    >
                      {t(`ORDER_STATUS_${order.status}`, order.status)}
                    </span>
                    <span
                      className={`rounded-xl px-2 py-1 text-xs font-bold ${PAYMENT_CLASS[order.paymentStatus] ?? "bg-gray-100 text-gray-700"}`}
                    >
                      {t(
                        `PAYMENT_STATUS_${order.paymentStatus}`,
                        order.paymentStatus,
                      )}
                    </span>
                    <span className="text-sm font-bold text-gray-900">
                      R$ {Number(order.total).toFixed(2)}
                    </span>
                    <svg
                      className={`h-4 w-4 text-smoke transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
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
                {order.paymentStatus === "PENDENTE" &&
                  order.status !== "CANCELADO" && (
                    <button
                      type="button"
                      disabled={isPaying && payingId === order.id}
                      onClick={() => markAsPaid(order.id)}
                      className="shrink-0 rounded-xl bg-green-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-green-700 disabled:opacity-50"
                    >
                      {isPaying && payingId === order.id
                        ? "..."
                        : t("ADMIN_HISTORY_MARK_PAID", "✓ Pago")}
                    </button>
                  )}
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="border-t border-gray-100 px-4 pb-4 pt-3">
                  <p className="mb-1 text-xs text-smoke sm:hidden">
                    {formatDate(order.createdAt)}
                  </p>

                  {needsRefundFlag && (
                    <div className="mb-3 rounded-xl border border-red-200 bg-red-100 px-3 py-2 text-xs text-red-800 font-semibold">
                      ⚠️{" "}
                      {t(
                        "ADMIN_HISTORY_REFUND_WARNING",
                        "Pedido cancelado após pagamento aprovado — realizar estorno ao cliente.",
                      )}
                    </div>
                  )}

                  {order.deliveryAddress && (
                    <p className="mb-2 text-xs text-smoke">
                      <span className="font-semibold text-gray-700">
                        {t("ADMIN_HISTORY_ADDRESS", "Endereço")}:
                      </span>{" "}
                      {order.deliveryAddress}
                    </p>
                  )}

                  {order.notes && (
                    <p className="mb-2 rounded-xl bg-gray-100 px-3 py-1.5 text-xs text-gray-700">
                      {t("ADMIN_HISTORY_NOTES", "Obs")}: {order.notes}
                    </p>
                  )}

                  <ul className="space-y-1">
                    {order.items?.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 text-sm"
                      >
                        <span className="text-gray-900">
                          {item.product?.name ??
                            t("ADMIN_HISTORY_ITEM", "Item")}
                          <span className="ml-2 text-xs text-gray-500">
                            × {item.quantity}
                          </span>
                        </span>
                        <span className="text-sm font-semibold text-gray-900">
                          R$ {Number(item.totalPrice).toFixed(2)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <p className="mt-3 text-right text-sm font-bold text-gray-900">
                    {t("ADMIN_HISTORY_TOTAL", "Total")}:{" "}
                    {Number(order.total).toLocaleString(locale || "pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}

export default AdminOrderHistoryPage;
