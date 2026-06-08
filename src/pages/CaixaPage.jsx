import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../lib/api.js";
import { askPaymentMethod } from "../lib/paymentMethodPrompt.js";
import { isRegularProduct } from "../lib/productVisibility.js";
import {
  installKitchenOrderAudioUnlock,
  playCashOrderAudio,
} from "../lib/playKitchenAlertTone.js";

const currency = (value) =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const STATUS_LABEL = {
  AGUARDANDO_PAGAMENTO: "Aguardando pagamento",
  RECEBIDO: "Recebido",
  PREPARANDO: "Preparando",
  PRONTO: "Pronto",
  SAIU_PARA_ENTREGA: "Saiu p/ entrega",
  ENTREGUE: "Entregue",
  CANCELADO: "Cancelado",
  MULTIPLOS: "Vários pedidos",
};

function getOrigin(order) {
  if (order.comanda) {
    return {
      type: "Comanda",
      title: `Comanda ${order.comanda.number}`,
      subtitle: order.comanda.name,
      tone: "bg-purple-50 text-purple-800 border-purple-200",
    };
  }

  if (order.mesa) {
    return {
      type: "Mesa",
      title: order.mesa.name ?? `Mesa ${order.mesa.number ?? ""}`.trim(),
      subtitle: order.mesa.number ? `Mesa ${order.mesa.number}` : "Mesa",
      tone: "bg-blue-50 text-blue-800 border-blue-200",
    };
  }

  if (order.isPickup) {
    return {
      type: "Retirada",
      title: "Retirada no local",
      subtitle: order.user?.name ?? "Cliente",
      tone: "bg-amber-50 text-amber-800 border-amber-200",
    };
  }

  if (order.deliveryAddress) {
    return {
      type: "Entrega",
      title: "Entrega",
      subtitle: order.user?.name ?? order.deliveryAddress,
      tone: "bg-green-50 text-green-800 border-green-200",
    };
  }

  return {
    type: "Pedido",
    title: order.user?.name ?? "Pedido",
    subtitle: "Balcao",
    tone: "bg-gray-50 text-gray-800 border-gray-200",
  };
}

function formatTime(value) {
  if (!value) return "--:--";
  return new Date(value).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function decorateOrderItems(order) {
  return (order.items ?? []).map((item) => ({
    ...item,
    id: `${order.id}-${item.id}`,
    originalItemId: item.id,
    sourceOrderId: order.id,
  }));
}

function groupPendingOrdersByComanda(orders) {
  const grouped = new Map();
  const result = [];

  for (const order of orders) {
    if (!order.comanda?.id) {
      result.push({
        ...order,
        orderIds: [order.id],
        orders: [order],
        items: decorateOrderItems(order),
      });
      continue;
    }

    const key = order.comanda.id;
    const current = grouped.get(key);

    if (current) {
      current.orders.push(order);
      current.orderIds.push(order.id);
      current.total += Number(order.total ?? 0);
      current.items.push(...decorateOrderItems(order));
      if (new Date(order.createdAt) < new Date(current.createdAt)) {
        current.createdAt = order.createdAt;
      }
      current.status = "MULTIPLOS";
      continue;
    }

    const groupedOrder = {
      ...order,
      id: `comanda-${key}`,
      orderIds: [order.id],
      orders: [order],
      total: Number(order.total ?? 0),
      items: decorateOrderItems(order),
    };

    grouped.set(key, groupedOrder);
    result.push(groupedOrder);
  }

  return result;
}

function PendingOrderCard({
  order,
  products,
  selectedAddProductId,
  editingTotals,
  onPay,
  onOrderTotalChange,
  onUpdateOrderTotal,
  onAddProductChange,
  onAddProduct,
  onRemoveItem,
  selectedItemIds,
  onToggleItem,
  activeTotalEditorId,
  onStartTotalEdit,
  onStopTotalEdit,
  disabled,
  updatingTotal,
  addingItem,
}) {
  const origin = getOrigin(order);
  const orderCount = order.orderIds?.length ?? 1;
  const selectedCount = (order.items ?? []).filter((item) =>
    selectedItemIds.has(item.id),
  ).length;

  return (
    <article className="rounded-3xl border border-gold/20 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${origin.tone}`}
            >
              {origin.type}
            </span>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600">
              {orderCount > 1
                ? `${orderCount} pedidos`
                : `#${order.orderIds?.[0]?.slice(-6).toUpperCase()}`}
            </span>
          </div>
          <h2 className="mt-3 text-2xl font-black text-primary">
            {origin.title}
          </h2>
          <p className="mt-1 text-sm font-semibold text-gray-500">
            {origin.subtitle} - {formatTime(order.createdAt)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs font-bold uppercase tracking-widest text-red-500">
            Em aberto
          </p>
          <p className="text-3xl font-black text-red-600">
            {currency(order.total)}
          </p>
          <p className="mt-1 text-xs font-semibold text-gray-500">
            {STATUS_LABEL[order.status] ?? order.status}
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-orange-200 bg-orange-50 p-3">
        <p className="mb-2 text-xs font-black uppercase tracking-widest text-orange-700">
          Adicionar produto ja entregue
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedAddProductId}
            onChange={(event) => onAddProductChange(order.id, event.target.value)}
            disabled={disabled || addingItem}
            className="min-w-[220px] flex-1 rounded-xl border border-orange-200 bg-white px-3 py-3 text-sm font-bold text-gray-800 outline-none transition focus:border-orange-500 disabled:opacity-60"
          >
            <option value="">Selecione um produto</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onAddProduct(order)}
            disabled={disabled || addingItem || !selectedAddProductId}
            className="rounded-xl bg-orange-600 px-4 py-3 text-sm font-black uppercase text-white transition hover:bg-orange-700 disabled:opacity-50"
          >
            Adicionar
          </button>
        </div>
      </div>

      <ul className="mt-5 space-y-2">
        {(order.items ?? []).map((item) => (
          <li
            key={item.id}
            className="rounded-2xl bg-accent/60 px-4 py-3"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedItemIds.has(item.id)}
                    onChange={() => onToggleItem(item.id)}
                    className="h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  <span className="text-base font-bold text-gray-900">
                    {item.quantity}x{" "}
                    {item.product?.name ?? item.productName ?? "Item"}
                  </span>
                </label>
                {orderCount > 1 ? (
                  <p className="mt-1 text-xs font-bold uppercase text-gray-500">
                    Pedido #{item.sourceOrderId?.slice(-6).toUpperCase()}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm font-black text-primary">
                  {currency(item.totalPrice)}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onRemoveItem({
                      orderId: item.sourceOrderId,
                      itemId: item.originalItemId,
                    })
                  }
                  disabled={disabled}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-xs font-black leading-none text-white transition hover:bg-red-700 disabled:opacity-50"
                  title="Remover item"
                >
                  X
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {order.notes ? (
        <p className="mt-4 rounded-2xl bg-red-600 px-4 py-3 text-sm font-black uppercase text-white">
          Obs: {order.notes}
        </p>
      ) : null}

      <div className="mt-5 flex justify-end">
        {activeTotalEditorId === order.id ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="0.01"
              autoFocus
              value={editingTotals[order.id] ?? Number(order.total ?? 0).toFixed(2)}
              onChange={(event) => onOrderTotalChange(order.id, event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  onUpdateOrderTotal(
                    order.orderIds?.[0] ?? order.id,
                    editingTotals[order.id] ?? Number(order.total ?? 0).toFixed(2),
                  );
                  onStopTotalEdit();
                }
                if (event.key === "Escape") {
                  onStopTotalEdit();
                }
              }}
              className="w-28 rounded-xl border border-orange-300 bg-white px-3 py-2 text-right text-sm font-black text-gray-900 outline-none focus:border-orange-500"
            />
            <button
              type="button"
              onClick={() => {
                onUpdateOrderTotal(
                  order.orderIds?.[0] ?? order.id,
                  editingTotals[order.id] ?? Number(order.total ?? 0).toFixed(2),
                );
                onStopTotalEdit();
              }}
              disabled={disabled || updatingTotal || orderCount > 1}
              className="rounded-xl bg-orange-600 px-3 py-2 text-xs font-black uppercase text-white transition hover:bg-orange-700 disabled:opacity-50"
            >
              OK
            </button>
          </div>
        ) : orderCount === 1 ? (
          <button
            type="button"
            onClick={() =>
              onStartTotalEdit(order.id, Number(order.total ?? 0).toFixed(2))
            }
            disabled={disabled || updatingTotal}
            className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-xs font-black uppercase text-orange-700 transition hover:border-orange-400 hover:bg-orange-100 disabled:opacity-50"
          >
            Alterar total
          </button>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => onPay(order)}
        disabled={disabled}
        className="mt-5 w-full rounded-2xl bg-green-600 px-4 py-4 text-lg font-black uppercase text-white shadow-sm transition hover:bg-green-700 disabled:opacity-50"
      >
        {selectedCount
          ? `Dar baixa em ${selectedCount} selecionado(s)`
          : "Dar baixa / pago tudo"}
      </button>
    </article>
  );
}

export default function CaixaPage() {
  const queryClient = useQueryClient();
  const [originFilter, setOriginFilter] = useState("TODOS");
  const [comandaSearch, setComandaSearch] = useState("");
  const [editingTotals, setEditingTotals] = useState({});
  const [addProductSelections, setAddProductSelections] = useState({});
  const [selectedItemIds, setSelectedItemIds] = useState(() => new Set());
  const [activeTotalEditorId, setActiveTotalEditorId] = useState(null);

  useEffect(() => installKitchenOrderAudioUnlock(), []);

  useEffect(() => {
    const handleOrderCreated = () => {
      playCashOrderAudio();
    };

    window.addEventListener("pc:order-created", handleOrderCreated);

    return () => {
      window.removeEventListener("pc:order-created", handleOrderCreated);
    };
  }, []);

  const { data: orders = [], isLoading, isError } = useQuery({
    queryKey: ["caixa-pending-payments"],
    queryFn: async () =>
      (await api.get("/orders/pending-payments")).data?.data ?? [],
    refetchInterval: 20_000,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["caixa-products"],
    queryFn: async () =>
      ((await api.get("/products")).data?.data ?? []).filter(isRegularProduct),
  });

  const invalidatePaymentViews = () => {
    queryClient.invalidateQueries({ queryKey: ["caixa-pending-payments"] });
    queryClient.invalidateQueries({ queryKey: ["admin-orders-preview"] });
    queryClient.invalidateQueries({ queryKey: ["comandas-open-totals"] });
    queryClient.invalidateQueries({ queryKey: ["atendente-orders"] });
    queryClient.invalidateQueries({ queryKey: ["atendente-comanda-orders"] });
  };

  const markPaid = useMutation({
    mutationFn: async ({ orderIds, paymentMethod, itemGroups }) => {
      if (itemGroups?.length) {
        return Promise.all(
          itemGroups.map(({ orderId, itemIds }) =>
            api.patch(`/orders/${orderId}/mark-paid`, {
              paymentMethod,
              itemIds,
            }),
          ),
        );
      }

      return Promise.all(
        orderIds.map((orderId) =>
          api.patch(`/orders/${orderId}/mark-paid`, { paymentMethod }),
        ),
      );
    },
    onSuccess: (_response, variables) => {
      if (variables?.selectedKeys?.length) {
        setSelectedItemIds((current) => {
          const next = new Set(current);
          variables.selectedKeys.forEach((key) => next.delete(key));
          return next;
        });
      }
      invalidatePaymentViews();
      toast.success("Pagamento baixado.");
    },
    onError: (error) =>
      toast.error(
        error?.response?.data?.error?.message ?? "Erro ao baixar pagamento.",
      ),
  });

  const updateTotal = useMutation({
    mutationFn: ({ orderId, total }) =>
      api.patch(`/orders/${orderId}/total`, { total }),
    onSuccess: (_response, variables) => {
      setEditingTotals((current) => {
        const next = { ...current };
        delete next[variables.orderId];
        return next;
      });
      invalidatePaymentViews();
      toast.success("Valor atualizado.");
    },
    onError: (error) =>
      toast.error(
        error?.response?.data?.error?.message ?? "Erro ao alterar valor.",
      ),
  });

  const addItem = useMutation({
    mutationFn: ({ orderId, productId }) =>
      api.post(`/orders/${orderId}/items`, { productId, quantity: 1 }),
    onSuccess: () => {
      invalidatePaymentViews();
      toast.success("Produto adicionado.");
    },
    onError: (error) =>
      toast.error(
        error?.response?.data?.error?.message ?? "Erro ao adicionar produto.",
      ),
  });

  const removeItem = useMutation({
    mutationFn: ({ orderId, itemId }) =>
      api.delete(`/orders/${orderId}/items/${itemId}`),
    onSuccess: () => {
      invalidatePaymentViews();
      toast.success("Item removido.");
    },
    onError: (error) =>
      toast.error(
        error?.response?.data?.error?.message ?? "Erro ao remover item.",
      ),
  });

  const totals = useMemo(() => {
    const pendingTotal = orders.reduce(
      (sum, order) => sum + Number(order.total ?? 0),
      0,
    );
    return { count: orders.length, pendingTotal };
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const normalizedComandaSearch = comandaSearch.trim().toLowerCase();

    const filtered = orders.filter((order) => {
      const matchesOrigin =
        originFilter === "TODOS" || getOrigin(order).type === originFilter;

      if (!matchesOrigin) return false;
      if (!normalizedComandaSearch) return true;

      if (!order.comanda) return false;

      const haystack =
        `${order.comanda.name ?? ""} ${order.comanda.number ?? ""}`.toLowerCase();
      return haystack.includes(normalizedComandaSearch);
    });

    return groupPendingOrdersByComanda(filtered);
  }, [comandaSearch, orders, originFilter]);

  const handleToggleItem = (itemId) => {
    setSelectedItemIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handlePay = async (order) => {
    const selectedItems = (order.items ?? []).filter((item) =>
      selectedItemIds.has(item.id),
    );
    const selectedTotal = selectedItems.reduce(
      (sum, item) => sum + Number(item.totalPrice ?? 0),
      0,
    );
    const paymentMethod = await askPaymentMethod({
      title: `Baixar ${getOrigin(order).title}`,
      text: `Total em aberto: ${currency(
        selectedItems.length ? selectedTotal : order.total,
      )}`,
    });
    if (paymentMethod) {
      if (selectedItems.length) {
        const groups = new Map();
        selectedItems.forEach((item) => {
          const itemIds = groups.get(item.sourceOrderId) ?? [];
          itemIds.push(item.originalItemId);
          groups.set(item.sourceOrderId, itemIds);
        });

        markPaid.mutate({
          itemGroups: [...groups.entries()].map(([orderId, itemIds]) => ({
            orderId,
            itemIds,
          })),
          selectedKeys: selectedItems.map((item) => item.id),
          paymentMethod,
        });
        return;
      }

      markPaid.mutate({ orderIds: order.orderIds ?? [order.id], paymentMethod });
    }
  };

  const handleOrderTotalChange = (orderId, value) => {
    setEditingTotals((current) => ({ ...current, [orderId]: value }));
  };

  const handleStartTotalEdit = (orderId, value) => {
    setActiveTotalEditorId(orderId);
    setEditingTotals((current) => ({
      ...current,
      [orderId]: current[orderId] ?? value,
    }));
  };

  const handleUpdateOrderTotal = (orderId, value) => {
    const total = Number(String(value).replace(",", "."));

    if (!Number.isFinite(total) || total < 0) {
      toast.error("Informe um valor valido.");
      return;
    }

    updateTotal.mutate({ orderId, total });
  };

  const handleAddProductChange = (cardId, productId) => {
    setAddProductSelections((current) => ({
      ...current,
      [cardId]: productId,
    }));
  };

  const handleAddProduct = (order) => {
    const productId = addProductSelections[order.id];
    const orderId = order.orderIds?.[0] ?? order.id;

    if (!orderId || !productId) return;

    addItem.mutate(
      { orderId, productId },
      {
        onSuccess: () => {
          setAddProductSelections((current) => ({
            ...current,
            [order.id]: "",
          }));
        },
      },
    );
  };

  const handleRemoveItem = ({ orderId, itemId }) => {
    if (!orderId || !itemId) return;
    removeItem.mutate({ orderId, itemId });
  };

  const filters = ["TODOS", "Mesa", "Comanda", "Entrega", "Retirada", "Pedido"];

  return (
    <main className="min-h-screen bg-accent px-4 py-6 text-gray-900 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl text-gold">Caixa</h1>
            <p className="mt-1 text-sm text-smoke">
              Todos os pedidos em aberto para receber e dar baixa.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/comandas"
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-600"
            >
              Comandas
            </Link>
            <Link
              to="/admin"
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-600"
            >
              Voltar
            </Link>
          </div>
        </div>

        <div className="mb-5 space-y-3">
          <input
            type="search"
            value={comandaSearch}
            onChange={(event) => setComandaSearch(event.target.value)}
            placeholder="Pesquisar comanda por nome ou número"
            className="w-full rounded-2xl border-2 border-orange-300 bg-orange-50 px-5 py-5 text-base font-black text-gray-900 shadow-sm outline-none transition placeholder:text-orange-700/60 focus:border-orange-600 focus:bg-white focus:ring-4 focus:ring-orange-200"
          />
          <div className="flex flex-wrap gap-2">
            {filters.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setOriginFilter(filter)}
                className={`rounded-full px-4 py-2 text-sm font-black ${
                  originFilter === filter
                    ? "bg-primary text-white"
                    : "border border-gray-200 bg-white text-gray-600"
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <section className="mb-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-red-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-bold uppercase tracking-widest text-red-500">
              Total em aberto
            </p>
            <p className="mt-1 text-5xl font-black text-red-600">
              {currency(totals.pendingTotal)}
            </p>
          </div>
          <div className="rounded-3xl border border-gold/20 bg-white p-5 shadow-sm">
            <p className="text-sm font-bold uppercase tracking-widest text-smoke">
              Pedidos pendentes
            </p>
            <p className="mt-1 text-5xl font-black text-primary">
              {totals.count}
            </p>
          </div>
        </section>

        {isLoading ? (
          <div className="rounded-3xl border border-gray-200 bg-white p-10 text-center font-bold text-gray-500">
            Carregando caixa...
          </div>
        ) : isError ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-10 text-center font-bold text-red-600">
            Nao foi possivel carregar os pagamentos pendentes.
          </div>
        ) : !filteredOrders.length ? (
          <div className="rounded-3xl border border-dashed border-gray-300 bg-white/70 p-16 text-center">
            <p className="text-3xl font-black uppercase text-primary">
              Sem pagamentos pendentes
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Quando tiver mesa, comanda, entrega ou retirada em aberto, vai
              aparecer aqui.
            </p>
          </div>
        ) : (
          <section className="grid gap-4 xl:grid-cols-2">
            {filteredOrders.map((order) => (
              <PendingOrderCard
                key={order.id}
                order={order}
                products={products}
                selectedAddProductId={addProductSelections[order.id] ?? ""}
                editingTotals={editingTotals}
                onPay={handlePay}
                onOrderTotalChange={handleOrderTotalChange}
                onUpdateOrderTotal={handleUpdateOrderTotal}
                onAddProductChange={handleAddProductChange}
                onAddProduct={handleAddProduct}
                onRemoveItem={handleRemoveItem}
                selectedItemIds={selectedItemIds}
                onToggleItem={handleToggleItem}
                activeTotalEditorId={activeTotalEditorId}
                onStartTotalEdit={handleStartTotalEdit}
                onStopTotalEdit={() => setActiveTotalEditorId(null)}
                disabled={
                  markPaid.isPending || updateTotal.isPending || addItem.isPending
                  || removeItem.isPending
                }
                updatingTotal={updateTotal.isPending}
                addingItem={addItem.isPending}
              />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
