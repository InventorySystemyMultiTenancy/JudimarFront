import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../lib/api.js";

const ACTIVE_STATUSES = ["RECEBIDO", "PREPARANDO", "PRONTO", "SAIU_PARA_ENTREGA"];

function formatRelativeTime(timestamp) {
  if (!timestamp) return "";
  const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (diff < 60) return `${diff}s atrás`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  return `${Math.floor(diff / 3600)}h atrás`;
}

function getPendingWaiterItems(order) {
  return (order.items ?? []).filter(
    (item) => item.product?.waiterOnly && !item.waiterDeliveredAt,
  );
}

function getOrderOriginLabel(order) {
  if (order.mesa) {
    return order.mesa.name ?? `Mesa ${order.mesa.number ?? ""}`.trim();
  }
  if (order.comanda) {
    return `Comanda ${order.comanda.number ?? ""}`.trim();
  }
  if (order.mesaId) return "Mesa";
  if (order.comandaId) return "Comanda";
  return order.user?.name ?? "Pedido";
}

export default function WaiterDrinksPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    data: orders = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["waiter-drink-orders"],
    queryFn: async () => {
      const res = await api.get("/orders");
      return res.data?.data ?? [];
    },
    refetchInterval: 15_000,
  });

  const drinkOrders = useMemo(
    () =>
      orders
        .filter((order) => ACTIVE_STATUSES.includes(order.status))
        .map((order) => ({
          ...order,
          waiterItems: getPendingWaiterItems(order),
        }))
        .filter((order) => order.waiterItems.length > 0)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
    [orders],
  );

  const pendingItemsCount = drinkOrders.reduce(
    (sum, order) => sum + order.waiterItems.length,
    0,
  );

  const deliverMutation = useMutation({
    mutationFn: async ({ orderId, itemIds }) => {
      const res = await api.patch(`/orders/${orderId}/waiter-items/delivered`, {
        itemIds,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["waiter-drink-orders"] });
      queryClient.invalidateQueries({ queryKey: ["atendente-orders"] });
      toast.success("Bebida entregue.");
    },
    onError: (error) => {
      toast.error(
        error?.response?.data?.error?.message ||
          "Não foi possível dar baixa na bebida.",
      );
    },
  });

  return (
    <main className="min-h-screen bg-accent/30 px-4 py-6 text-gray-900 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl text-primary">
              Bebidas do garçom
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Itens marcados como somente garçom, separados por mesa ou comanda.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-secondary/10 px-4 py-2 text-sm font-bold text-secondary">
              {pendingItemsCount} item(ns)
            </span>
            <button
              type="button"
              onClick={() => navigate("/atendente")}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 transition hover:border-secondary/40"
            >
              Atendente
            </button>
          </div>
        </header>

        {isLoading ? (
          <div className="grid animate-pulse gap-4 sm:grid-cols-2">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="h-48 rounded-2xl bg-white" />
            ))}
          </div>
        ) : null}

        {isError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Falha ao carregar bebidas.
          </div>
        ) : null}

        {!isLoading && !isError && drinkOrders.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-300 bg-white p-10 text-center">
            <p className="font-display text-2xl text-primary">
              Nenhuma bebida pendente
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Quando um pedido tiver bebida ou item somente garçom, ele aparece aqui.
            </p>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          {drinkOrders.map((order) => (
            <article
              key={order.id}
              className="rounded-2xl border border-cyan-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-xl text-primary">
                    {getOrderOriginLabel(order)}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Pedido #{order.id.slice(-6).toUpperCase()} •{" "}
                    {formatRelativeTime(order.createdAt)}
                  </p>
                </div>
                <span className="rounded-full bg-cyan-100 px-3 py-1 text-xs font-bold text-cyan-700">
                  {order.waiterItems.length} bebida(s)
                </span>
              </div>

              <ul className="mt-4 space-y-2">
                {order.waiterItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-cyan-50 px-3 py-2 text-sm"
                  >
                    <span className="font-semibold text-primary">
                      {item.quantity}x {item.product?.name ?? "Item"}
                    </span>
                    {item.notes ? (
                      <span className="text-xs text-gray-500">{item.notes}</span>
                    ) : null}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() =>
                  deliverMutation.mutate({
                    orderId: order.id,
                    itemIds: order.waiterItems.map((item) => item.id),
                  })
                }
                disabled={deliverMutation.isPending}
                className="mt-5 w-full rounded-2xl bg-green-600 px-4 py-3 text-sm font-black uppercase text-white transition hover:bg-green-700 disabled:opacity-50"
              >
                Entregue a bebida
              </button>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
