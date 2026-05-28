import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import ProductCustomizer from "../components/ProductCustomizer.jsx";
import { useCart } from "../context/CartContext.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { api } from "../lib/api.js";
import { askPaymentMethod } from "../lib/paymentMethodPrompt.js";
import {
  clearWaiterCalls,
  dismissWaiterCall,
  getWaiterCalls,
  subscribeToWaiterCalls,
} from "../lib/waiterCallsStore.js";

const STATUS_LABEL = {
  RECEBIDO: "Recebido",
  PREPARANDO: "Preparando",
  PRONTO: "Pronto ✓",
  LEVAR_PARA_MESA: "Levar à mesa",
  AGUARDANDO_PAGAMENTO: "Ag. pagamento",
};

const STATUS_COLOR = {
  RECEBIDO: "bg-blue-100 text-blue-700",
  PREPARANDO: "bg-yellow-100 text-yellow-800",
  PRONTO: "bg-green-100 text-green-700",
  LEVAR_PARA_MESA: "bg-amber-100 text-amber-700",
  AGUARDANDO_PAGAMENTO: "bg-gray-100 text-gray-600",
  ENTREGUE: "bg-emerald-100 text-emerald-700",
};

const currency = (value) =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const isValidEntityId = (value) => String(value || "").trim().length > 0;

const mapItemToApi = (item) => {
  const payload = item.payload || {};
  const productId = payload.productId || item.id;

  if (isValidEntityId(productId)) {
    return {
      productId,
      addonIds: (
        payload.addonIds || (item.addons || []).map((addon) => addon.id)
      ).filter(isValidEntityId),
      removedIngredients:
        payload.removedIngredients ||
        (item.removals || []).join(", ") ||
        undefined,
      priceVariant: payload.priceVariant || item.priceVariant || undefined,
      quantity: item.quantity,
      notes: item.observation || item.notes || undefined,
    };
  }
};

function AttendantProductCard({
  product,
  featured = false,
  showPhoto = false,
}) {
  const [showCustomizer, setShowCustomizer] = useState(false);
  const imageUrl = product.imageUrl ?? product.image ?? product.photo ?? null;

  return (
    <>
      <article
        className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition cursor-pointer hover:border-secondary/40 hover:shadow-md"
        onClick={() => setShowCustomizer(true)}
      >
        {showPhoto && imageUrl ? (
          <img
            src={imageUrl}
            alt={product.name}
            className="h-36 w-full object-cover"
          />
        ) : null}
        <div className={`p-4 ${showPhoto && imageUrl ? "pt-3" : ""}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-display text-lg text-primary">
                {product.name}
              </h3>
              {product.description ? (
                <p className="mt-1 line-clamp-2 text-xs text-gray-500">
                  {product.description}
                </p>
              ) : null}
            </div>
            {featured ? (
              <span className="rounded-full bg-secondary px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-white">
                Destaque
              </span>
            ) : null}
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className="text-sm font-bold text-secondary">
              {currency(
                product.price ?? product.basePrice ?? product.sizes?.[0]?.price,
              )}
            </span>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setShowCustomizer(true);
              }}
              className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-secondary"
            >
              Adicionar
            </button>
          </div>
        </div>
      </article>

      {showCustomizer ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <div
            className="absolute inset-0 bg-primary/50 backdrop-blur-sm"
            onClick={() => setShowCustomizer(false)}
          />
          <div className="relative z-10 w-full max-w-sm">
            <ProductCustomizer
              product={product}
              addonsOptions={product.addons ?? []}
              onClose={() => setShowCustomizer(false)}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

function formatRelativeTime(timestamp) {
  if (!timestamp) return "";
  const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (diff < 60) return `${diff}s atrás`;
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  return `${Math.floor(diff / 3600)}h atrás`;
}

function isDeliveredWaiterItem(item) {
  return Boolean(item.product?.waiterOnly && item.waiterDeliveredAt);
}

function OrderItemName({ item }) {
  const delivered = isDeliveredWaiterItem(item);

  return (
    <span
      className={`inline-flex items-center gap-1 ${
        delivered ? "text-emerald-700 line-through decoration-2" : ""
      }`}
    >
      {delivered ? (
        <span
          className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-black leading-none text-white"
          aria-label="Entregue"
          title="Entregue"
        >
          ✓
        </span>
      ) : null}
      <span>
        {item.quantity}x {item.product?.name ?? "Item"}
      </span>
    </span>
  );
}

export default function AtendentePanel() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    items,
    clearCart,
    removeItem,
    setCartScope,
    updateQuantity,
    subtotal,
    formatted,
  } = useCart();

  const [waiterCalls, setWaiterCalls] = useState(() => getWaiterCalls());
  const [, setRelativeTimeTick] = useState(0);
  const [selectedComandaId, setSelectedComandaId] = useState("");
  const [newComandaName, setNewComandaName] = useState("");
  const [comandaSearch, setComandaSearch] = useState("");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [showComandas, setShowComandas] = useState(true);
  const [showProducts, setShowProducts] = useState(false);
  const [showPhotos, setShowPhotos] = useState(false);
  const [mesaNotes, setMesaNotes] = useState({});

  useEffect(() => subscribeToWaiterCalls(setWaiterCalls), []);

  // Atualiza relativeTime a cada 30s
  useEffect(() => {
    const id = setInterval(() => {
      setRelativeTimeTick((tick) => tick + 1);
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  const { data: orders = [] } = useQuery({
    queryKey: ["atendente-orders"],
    queryFn: async () => {
      const res = await api.get("/orders");
      return res.data?.data ?? [];
    },
    refetchInterval: 30_000,
  });

  const { data: comandas = [] } = useQuery({
    queryKey: ["atendente-comandas"],
    queryFn: async () => {
      const res = await api.get("/comandas");
      return res.data?.data ?? [];
    },
    staleTime: 60_000,
  });

  const { data: comandaOpenTotals = [] } = useQuery({
    queryKey: ["atendente-comanda-open-totals"],
    queryFn: async () => {
      const res = await api.get("/comandas/open-totals");
      return res.data?.data ?? [];
    },
    refetchInterval: 15_000,
  });

  const { data: products = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ["atendente-products"],
    queryFn: async () => {
      const res = await api.get("/products");
      return res.data?.data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: topProducts = [] } = useQuery({
    queryKey: ["atendente-top-products"],
    queryFn: async () => {
      const res = await api.get("/products/top?limit=6");
      return res.data?.data ?? [];
    },
    staleTime: 10 * 60 * 1000,
  });

  const selectedComandaTargetId = selectedComandaId || comandas[0]?.id || "";

  useEffect(() => {
    setCartScope(
      selectedComandaTargetId ? `comanda_${selectedComandaTargetId}` : "default",
    );

    return () => {
      setCartScope("default");
    };
  }, [selectedComandaTargetId, setCartScope]);

  const { data: selectedComandaOrders = [], isLoading: isLoadingComandaOrders } =
    useQuery({
      queryKey: ["atendente-comanda-orders", selectedComandaTargetId],
      queryFn: async () => {
        const res = await api.get(`/comandas/${selectedComandaTargetId}/orders`);
        return res.data?.data ?? [];
      },
      enabled: Boolean(selectedComandaTargetId),
      refetchInterval: 15_000,
    });

  const comandaStatsById = useMemo(() => {
    const stats = new Map();
    for (const row of comandaOpenTotals) {
      stats.set(row.comandaId, {
        active: row.activeCount,
        pending: row.pendingTotal,
      });
    }
    return stats;
  }, [comandaOpenTotals]);

  const selectedComanda = useMemo(
    () =>
      comandas.find((comanda) => comanda.id === selectedComandaTargetId) ??
      null,
    [comandas, selectedComandaTargetId],
  );

  const filteredComandas = useMemo(() => {
    const normalized = comandaSearch.trim().toLowerCase();
    if (!normalized) return comandas;

    return comandas.filter((comanda) => {
      const haystack =
        `${comanda.name ?? ""} ${comanda.number ?? ""}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [comandaSearch, comandas]);

  const nextComandaNumber = useMemo(() => {
    const highestNumber = comandas.reduce(
      (highest, comanda) => Math.max(highest, Number(comanda.number) || 0),
      0,
    );
    return highestNumber + 1;
  }, [comandas]);

  const categories = useMemo(() => {
    const seen = new Set();
    const result = [];
    for (const p of products) {
      const cat = p.category ?? "";
      if (cat && !seen.has(cat)) {
        seen.add(cat);
        result.push(cat);
      }
    }
    return result;
  }, [products]);

  const filteredProducts = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return products.filter((product) => {
      if (selectedCategory && product.category !== selectedCategory)
        return false;
      if (!normalized) return true;
      const haystack =
        `${product.name} ${product.description ?? ""} ${product.category ?? ""}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }, [products, search, selectedCategory]);

  const activeOrders = selectedComandaOrders;
  const isLoadingActiveOrders = isLoadingComandaOrders;
  const selectedTarget = selectedComanda;
  const selectedTargetId = selectedComandaTargetId;
  const targetLabel = "comanda";
  const selectedTargetName =
    selectedComanda
      ? `Comanda ${selectedComanda.number} - ${selectedComanda.name}`
      : "";
  const notesKey = selectedTargetId ? `comanda_${selectedTargetId}` : "default";

  const pendingTargetTotal = useMemo(
    () =>
      activeOrders
        .filter(
          (order) =>
            order.paymentStatus !== "APROVADO" && order.status !== "CANCELADO",
        )
        .reduce((acc, order) => acc + Number(order.total ?? 0), 0),
    [activeOrders],
  );

  const visibleTargetOrders = useMemo(
    () =>
      activeOrders.filter(
        (order) =>
          !(order.status === "ENTREGUE" && order.paymentStatus === "APROVADO"),
      ),
    [activeOrders],
  );

  const readyOrders = useMemo(
    () =>
      orders
        .filter(
          (order) =>
            (order.mesaId || order.comandaId || order.mesa || order.comanda) &&
            ["PRONTO", "SAIU_PARA_ENTREGA", "LEVAR_PARA_MESA"].includes(
              order.status,
            ),
        )
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
    [orders],
  );

  const getOrderOriginLabel = useCallback((order) => {
    if (order.mesa) {
      return order.mesa.name ?? `Mesa ${order.mesa.number ?? ""}`.trim();
    }
    if (order.comanda) {
      return `Comanda ${order.comanda.number ?? ""}`.trim();
    }
    if (order.orderType === "MESA" || order.mesaId) return "Mesa";
    if (order.orderType === "COMANDA" || order.comandaId) return "Comanda";
    return "Pedido";
  }, []);

  const notes = mesaNotes[notesKey] ?? "";

  const createComandaMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post("/comandas", {
        name: newComandaName.trim(),
        number: nextComandaNumber,
      });
      return res.data?.data;
    },
    onSuccess: (comanda) => {
      setNewComandaName("");
      if (comanda?.id) {
        setSelectedComandaId(comanda.id);
      }
      queryClient.invalidateQueries({ queryKey: ["atendente-comandas"] });
      queryClient.invalidateQueries({
        queryKey: ["atendente-comanda-open-totals"],
      });
      queryClient.invalidateQueries({ queryKey: ["comandas"] });
      toast.success("Comanda criada.");
    },
    onError: (error) => {
      const message =
        error?.response?.data?.error?.message || "Erro ao criar comanda.";
      toast.error(message);
    },
  });

  // Avançar status do pedido
  const advanceMutation = useMutation({
    mutationFn: async ({ orderId, status, statuses }) => {
      const statusSteps = statuses ?? [status];
      let res = null;

      for (const nextStatus of statusSteps) {
        res = await api.patch(`/orders/${orderId}/status`, {
          status: nextStatus,
        });
      }

      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["atendente-orders"] });
      queryClient.invalidateQueries({ queryKey: ["atendente-mesa-orders"] });
      queryClient.invalidateQueries({ queryKey: ["atendente-comanda-orders"] });
      queryClient.invalidateQueries({
        queryKey: ["atendente-mesa-open-totals"],
      });
      queryClient.invalidateQueries({
        queryKey: ["atendente-comanda-open-totals"],
      });
      toast.success("Status atualizado!");
    },
    onError: (error) => {
      const message =
        error?.response?.data?.error?.message || "Erro ao atualizar status";
      toast.error(message);
    },
  });

  const createMesaOrderMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTargetId) {
        throw new Error(`Selecione uma ${targetLabel} antes de enviar o pedido.`);
      }

      const payload = {
        notes: notes.trim() || undefined,
        items: items.map(mapItemToApi).filter(Boolean),
      };

      const res = await api.post(
        `/comandas/${selectedTargetId}/orders`,
        payload,
      );
      return res.data?.data;
    },
    onSuccess: () => {
      clearCart();
      setMesaNotes((prev) => ({ ...prev, [notesKey]: "" }));
      queryClient.invalidateQueries({ queryKey: ["atendente-orders"] });
      queryClient.invalidateQueries({ queryKey: ["atendente-mesa-orders"] });
      queryClient.invalidateQueries({ queryKey: ["atendente-comanda-orders"] });
      queryClient.invalidateQueries({
        queryKey: ["atendente-mesa-open-totals"],
      });
      queryClient.invalidateQueries({
        queryKey: ["atendente-comanda-open-totals"],
      });
      toast.success(`Pedido lançado para a ${targetLabel}.`);
    },
    onError: (error) => {
      const message =
        error?.response?.data?.error?.message ||
        error?.message ||
        "Erro ao lançar pedido.";
      toast.error(message);
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async ({ orderId, paymentMethod }) => {
      const res = await api.patch(`/orders/${orderId}/mark-paid`, {
        paymentMethod,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["atendente-orders"] });
      queryClient.invalidateQueries({ queryKey: ["atendente-mesa-orders"] });
      queryClient.invalidateQueries({ queryKey: ["atendente-comanda-orders"] });
      queryClient.invalidateQueries({
        queryKey: ["atendente-mesa-open-totals"],
      });
      queryClient.invalidateQueries({
        queryKey: ["atendente-comanda-open-totals"],
      });
      toast.success("Pagamento baixado.");
    },
    onError: (error) => {
      const message =
        error?.response?.data?.error?.message ||
        "Não foi possível baixar o pagamento.";
      toast.error(message);
    },
  });

  const handleMarkDelivered = useCallback(
    (order) => {
      const statuses =
        order.status === "PRONTO"
          ? ["SAIU_PARA_ENTREGA", "ENTREGUE"]
          : ["ENTREGUE"];

      advanceMutation.mutate({ orderId: order.id, statuses });
    },
    [advanceMutation],
  );

  const handleMarkPaid = useCallback(
    async (orderId) => {
      const paymentMethod = await askPaymentMethod({
        title: "Dar baixa / pago",
        text: "Escolha a forma de pagamento recebida.",
      });
      if (!paymentMethod) return;
      markPaidMutation.mutate({ orderId, paymentMethod });
    },
    [markPaidMutation],
  );

  const handleClearCalls = useCallback(() => {
    clearWaiterCalls();
    toast.success("Chamadas limpas");
  }, []);

  const handleDismissCall = useCallback((call, index) => {
    dismissWaiterCall({ ...call, index });
    toast.success("Chamada baixada");
  }, []);

  const scrollToPanelSection = useCallback((sectionId) => {
    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, []);

  const handleSubmitMesaOrder = useCallback(() => {
    if (!selectedTargetId) {
      toast.error(`Selecione uma ${targetLabel}.`);
      return;
    }

    if (!items.length) {
      toast.error("Adicione itens ao pedido antes de enviar.");
      return;
    }

    createMesaOrderMutation.mutate();
  }, [createMesaOrderMutation, items.length, selectedTargetId, targetLabel]);

  const handleCreateComanda = useCallback(
    (event) => {
      event.preventDefault();

      if (!newComandaName.trim()) {
        toast.error("Informe o nome da comanda.");
        return;
      }

      createComandaMutation.mutate();
    },
    [createComandaMutation, newComandaName],
  );

  return (
    <div className="min-h-screen bg-accent/30 font-body">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-primary/20 bg-primary shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-8">
          <div className="flex items-center gap-3">
            <img
              src="/logo-judimar.png"
              alt="Judimar"
              className="h-9 w-auto object-contain"
            />
            <div>
              <h1 className="font-display text-lg leading-tight text-accent">
                Painel do Atendente
              </h1>
              {user?.name && (
                <p className="text-xs text-secondary">{user.name}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/bebidas")}
              className="rounded-lg border border-cyan-300/40 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-900/30"
            >
              Bebidas
            </button>
            <button
              type="button"
              onClick={() => navigate("/caixa")}
              className="rounded-lg border border-accent/30 px-3 py-2 text-xs font-semibold text-accent transition hover:bg-accent/10"
            >
              Caixa
            </button>
            <button
              type="button"
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="rounded-lg border border-red-400/30 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-900/30"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-8">
        {/* Chamadas de mesa */}
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl text-primary">
                Chamadas de Mesa
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                Pedidos de atendimento enviados pelas mesas via QR code.
              </p>
            </div>
            {waiterCalls.length > 0 && (
              <button
                type="button"
                onClick={handleClearCalls}
                className="rounded-full border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition hover:border-secondary/40 hover:text-secondary"
              >
                Limpar chamadas ({waiterCalls.length})
              </button>
            )}
          </div>

          {waiterCalls.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
              Nenhuma chamada pendente.
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {waiterCalls.map((call, index) => (
                <article
                  key={`${call.mesaId ?? "mesa"}-${call.timestamp ?? index}`}
                  className="rounded-2xl border-2 border-secondary/40 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-display text-xl text-primary">
                      Mesa {call?.mesaNumber ?? "—"}
                    </p>
                    <span className="rounded-full bg-secondary/10 px-2 py-1 text-[11px] font-semibold text-secondary">
                      {formatRelativeTime(call?.timestamp)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-secondary">
                    Atendimento solicitado
                  </p>
                  <button
                    type="button"
                    onClick={() => handleDismissCall(call, index)}
                    className="mt-4 w-full rounded-2xl bg-green-600 px-4 py-3 text-sm font-black uppercase text-white transition hover:bg-green-700"
                  >
                    Dar baixa
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl text-primary">Comandas</h2>
              <p className="mt-1 text-xs text-gray-500">
                Selecione a comanda para lançar pedido e acompanhar o histórico
                do dia.
              </p>
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600 shadow-sm">
              Comandas abertas: <strong>{comandas.length}</strong>
            </div>
          </div>

          <form
            onSubmit={handleCreateComanda}
            className="mt-4 grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_auto_auto]"
          >
            <input
              type="text"
              value={newComandaName}
              onChange={(event) => setNewComandaName(event.target.value)}
              placeholder="Nome da comanda"
              className="rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-secondary/60"
            />
            <div className="rounded-xl border border-gray-200 bg-accent/50 px-4 py-3 text-sm font-semibold text-primary">
              Próxima: {nextComandaNumber}
            </div>
            <button
              type="submit"
              disabled={createComandaMutation.isPending}
              className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white transition hover:bg-secondary disabled:opacity-50"
            >
              {createComandaMutation.isPending
                ? "Criando..."
                : "Criar comanda temporária"}
            </button>
            <p className="text-xs font-semibold text-gray-500 md:col-span-3">
              Comandas criadas pelo atendente são temporárias e serão removidas
              automaticamente às 00h. Os pedidos continuam salvos.
            </p>
          </form>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
              {selectedComanda
                ? `Selecionada: Comanda ${selectedComanda.number}`
                : "Nenhuma comanda selecionada"}
            </span>
            <button
              type="button"
              onClick={() => setShowComandas((value) => !value)}
              className="rounded-full border border-secondary/40 bg-white px-4 py-2 text-xs font-bold text-secondary shadow-sm transition hover:bg-secondary/10"
            >
              {showComandas ? "Ocultar comandas" : "Mostrar comandas"}
            </button>
          </div>

          {showComandas ? (
            <>
              <div className="mt-4">
                <input
                  type="search"
                  value={comandaSearch}
                  onChange={(event) => setComandaSearch(event.target.value)}
                  placeholder="Pesquisar comanda por nome ou número"
                  className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm outline-none transition focus:border-secondary/60"
                />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {filteredComandas.map((comanda) => {
                  const stats = comandaStatsById.get(comanda.id) ?? {
                    active: 0,
                    pending: 0,
                  };
                  const isSelected = comanda.id === selectedComandaTargetId;

                  return (
                    <button
                      key={comanda.id}
                      type="button"
                      onClick={() => {
                        setSelectedComandaId(comanda.id);
                        setShowProducts(true);
                        scrollToPanelSection("mesa-cardapio");
                      }}
                      className={`rounded-2xl border p-4 text-left transition ${
                        isSelected
                          ? "border-orange-600 bg-orange-500 text-white shadow-md"
                          : "border-gray-200 bg-white/80 hover:border-secondary/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p
                            className={`font-display text-lg ${
                              isSelected ? "text-white" : "text-primary"
                            }`}
                          >
                            Comanda {comanda.number}
                          </p>
                          <p
                            className={`text-xs uppercase tracking-[0.2em] ${
                              isSelected ? "text-white/80" : "text-gray-400"
                            }`}
                          >
                            {comanda.name}
                          </p>
                        </div>
                        {stats.active ? (
                          <span
                            className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                              isSelected
                                ? "bg-white text-orange-600"
                                : "bg-primary text-white"
                            }`}
                          >
                            {stats.active} ativos
                          </span>
                        ) : null}
                      </div>
                      <p
                        className={`mt-3 text-xs ${
                          isSelected ? "text-white/90" : "text-gray-500"
                        }`}
                      >
                        Em aberto: <strong>{currency(stats.pending)}</strong>
                      </p>
                    </button>
                  );
                })}
              </div>

              {comandas.length > 0 && filteredComandas.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                  Nenhuma comanda encontrada.
                </div>
              ) : null}
            </>
          ) : (
            <div className="mt-4 rounded-2xl border border-gray-200 bg-white/80 p-4 text-sm text-gray-600 shadow-sm">
              Lista de comandas oculta.
            </div>
          )}

          {selectedComanda ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => {
                  setShowProducts(false);
                  scrollToPanelSection("mesa-fechamento");
                }}
                className="rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-secondary"
              >
                Lançar pedido
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowProducts(true);
                  scrollToPanelSection("mesa-cardapio");
                }}
                className="rounded-2xl border border-secondary/40 bg-white px-4 py-3 text-sm font-bold text-secondary shadow-sm transition hover:bg-secondary/10"
              >
                Cardápio
              </button>
              <button
                type="button"
                onClick={() => scrollToPanelSection("mesa-historico")}
                className="rounded-2xl border border-primary/20 bg-white px-4 py-3 text-sm font-bold text-primary shadow-sm transition hover:bg-primary/5"
              >
                Histórico da comanda
              </button>
            </div>
          ) : null}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-6">
            <section
              id="mesa-cardapio"
              className="scroll-mt-6 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl text-primary">
                    Novo pedido{" "}
                    {selectedTargetName ? `• ${selectedTargetName}` : ""}
                  </h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Monte o pedido, vincule à {targetLabel} e o histórico fica salvo para
                    cobrança depois.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowProducts((value) => !value)}
                    className={`rounded-full border px-4 py-2 text-xs font-bold transition ${
                      showProducts
                        ? "border-primary bg-primary text-white"
                        : "border-secondary/40 bg-white text-secondary hover:bg-secondary/10"
                    }`}
                  >
                    {showProducts ? "Ocultar produtos" : "Mostrar produtos"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPhotos((v) => !v)}
                    disabled={!showProducts}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      showPhotos
                        ? "border-secondary bg-secondary text-white"
                        : "border-gray-300 bg-white text-gray-600 hover:border-secondary/40"
                    } disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    🖼 {showPhotos ? "Ocultar fotos" : "Ver fotos"}
                  </button>
                  {showProducts ? (
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Buscar item do cardápio"
                      className="w-full rounded-2xl border border-gray-200 px-4 py-2.5 text-sm outline-none transition focus:border-secondary/50 sm:max-w-xs"
                    />
                  ) : null}
                </div>
              </div>

              {showProducts ? (
                <>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedCategory("")}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition sm:px-3 sm:py-1 sm:text-xs ${
                        selectedCategory === ""
                          ? "bg-primary text-white"
                          : "bg-secondary/10 text-secondary hover:bg-secondary/20"
                      }`}
                    >
                      Todos
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() =>
                          setSelectedCategory((prev) => (prev === cat ? "" : cat))
                        }
                        className={`rounded-full px-4 py-2 text-sm font-semibold transition sm:px-3 sm:py-1 sm:text-xs ${
                          selectedCategory === cat
                            ? "bg-primary text-white"
                            : "bg-secondary/10 text-secondary hover:bg-secondary/20"
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>

                  {isLoadingProducts ? (
                    <div className="mt-6 text-sm text-gray-500">
                      Carregando cardápio...
                    </div>
                  ) : (
                    <div className="mt-6 grid gap-3 sm:grid-cols-2">
                      {filteredProducts.map((product) => (
                        <AttendantProductCard
                          key={product.id}
                          product={product}
                          featured={topProducts.some(
                            (entry) => entry.id === product.id,
                          )}
                          showPhoto={showPhotos}
                        />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowProducts(true)}
                  className="mt-5 w-full rounded-2xl border border-dashed border-secondary/40 bg-secondary/5 px-5 py-5 text-sm font-bold text-secondary transition hover:bg-secondary/10"
                >
                  Mostrar produtos para montar o pedido
                </button>
              )}
            </section>

            <section
              id="mesa-prontos"
              className="scroll-mt-6 rounded-3xl border border-green-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl text-primary">
                    Pedidos prontos
                  </h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Todos os pedidos liberados para levar até a mesa ou comanda.
                  </p>
                </div>
                <span className="rounded-2xl bg-green-100 px-3 py-2 text-xs font-semibold text-green-700">
                  {readyOrders.length} pronto(s)
                </span>
              </div>

              {readyOrders.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                  Nenhum pedido pronto no momento.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {readyOrders.map((order) => (
                    <article
                      key={`ready-${order.id}`}
                      className="rounded-2xl border border-green-200 bg-green-50/40 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-display text-lg text-primary">
                            Pedido #{order.id.slice(-6).toUpperCase()}
                          </p>
                          <p className="text-xs text-gray-500">
                            {getOrderOriginLabel(order)} •{" "}
                            {formatRelativeTime(order.createdAt)}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-1 text-[11px] font-semibold ${STATUS_COLOR[order.status] ?? "bg-gray-100 text-gray-500"}`}
                        >
                          {STATUS_LABEL[order.status] ?? order.status}
                        </span>
                      </div>

                      <ul className="mt-3 space-y-1 text-xs text-gray-600">
                        {(order.items ?? []).map((item) => (
                          <li key={item.id}>
                            <OrderItemName item={item} />
                          </li>
                        ))}
                      </ul>

                      <div className="mt-4 flex justify-end border-t border-green-100 pt-3">
                        <button
                          type="button"
                          onClick={() => handleMarkDelivered(order)}
                          disabled={advanceMutation.isPending}
                          className="rounded-xl bg-green-600 px-4 py-2 text-xs font-black uppercase text-white transition hover:bg-green-700 disabled:opacity-50"
                        >
                          Entregue a mesa
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section
              id="mesa-historico"
              className="scroll-mt-6 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl text-primary">
                    Pedidos da {targetLabel}
                  </h2>
                  <p className="mt-1 text-xs text-gray-500">
                    Pedidos do dia da {targetLabel} pendentes, ainda não entregues ou agu, pagamento
                  </p>
                </div>
                <div className="rounded-2xl bg-accent px-3 py-2 text-xs text-gray-600">
                  Em aberto: <strong>{currency(pendingTargetTotal)}</strong>
                </div>
              </div>

              {isLoadingActiveOrders ? (
                <div className="mt-4 text-sm text-gray-500">
                  Carregando histórico...
                </div>
              ) : visibleTargetOrders.length === 0 ? (
                <div className="mt-4 rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                  Nenhum pedido lançado para essa {targetLabel} hoje.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {visibleTargetOrders.map((order) => (
                    <article
                      key={order.id}
                      className="rounded-2xl border border-gray-200 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-display text-lg text-primary">
                            Pedido #{order.id.slice(-6).toUpperCase()}
                          </p>
                          <p className="text-xs text-gray-400">
                            {formatRelativeTime(order.createdAt)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span
                            className={`rounded-full px-2 py-1 text-[11px] font-semibold ${STATUS_COLOR[order.status] ?? "bg-gray-100 text-gray-500"}`}
                          >
                            {STATUS_LABEL[order.status] ?? order.status}
                          </span>
                          <span
                            className={`rounded-full px-2 py-1 text-[11px] font-semibold ${
                              order.paymentStatus === "APROVADO"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-amber-100 text-amber-700"
                            }`}
                          >
                            {order.paymentStatus === "APROVADO"
                              ? "Pago"
                              : "Pendente"}
                          </span>
                        </div>
                      </div>

                      <ul className="mt-3 space-y-1 text-xs text-gray-600">
                        {(order.items ?? []).map((item) => (
                          <li
                            key={item.id}
                            className="flex justify-between gap-3"
                          >
                            <OrderItemName item={item} />
                            <span>
                              {currency(
                                item.totalPrice ??
                                  item.unitPrice * item.quantity,
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>

                      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
                        <span className="text-sm font-semibold text-primary">
                          Total {currency(order.total)}
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {order.paymentStatus !== "APROVADO" ? (
                            <button
                              type="button"
                              onClick={() => handleMarkPaid(order.id)}
                              disabled={markPaidMutation.isPending}
                              className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                            >
                              Dar baixa / pago
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section
            id="mesa-fechamento"
            className="scroll-mt-6 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl text-primary">
                  Fechamento da {targetLabel}
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  Revise os itens do pedido atual antes de lançar para a {targetLabel}.
                </p>
              </div>
              {selectedTarget ? (
                <span className="rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">
                  Comanda {selectedComanda.number}
                </span>
              ) : null}
            </div>

            {items.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                Adicione itens do cardápio para montar o pedido desta {targetLabel}.
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                {items.map((item) => (
                  <div
                    key={item.key}
                    className="rounded-2xl border border-gray-200 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-primary">
                          {item.nome}
                        </p>
                        {item.observation ? (
                          <p className="mt-1 text-xs text-gray-500">
                            Obs: {item.observation}
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.key)}
                        className="text-xs font-semibold text-red-500 transition hover:text-red-700"
                      >
                        Remover
                      </button>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(
                              item.key,
                              Math.max(1, item.quantity - 1),
                            )
                          }
                          className="h-8 w-8 rounded-full border border-gray-200 text-sm font-bold text-primary"
                        >
                          -
                        </button>
                        <span className="w-6 text-center text-sm font-semibold text-primary">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateQuantity(
                              item.key,
                              Math.min(20, item.quantity + 1),
                            )
                          }
                          className="h-8 w-8 rounded-full border border-gray-200 text-sm font-bold text-primary"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-sm font-semibold text-secondary">
                        {currency(
                          (Number(item.price || 0) +
                            Number(
                              (item.addons || []).reduce(
                                (sum, addon) => sum + Number(addon?.price || 0),
                                0,
                              ),
                            )) *
                            item.quantity,
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <label className="mt-5 block text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">
              Observações do pedido
            </label>
            <textarea
              rows={4}
              value={notes}
              onChange={(event) =>
                setMesaNotes((prev) => ({
                  ...prev,
                  [notesKey]: event.target.value,
                }))
              }
              placeholder="Ex: cliente pediu ponto da carne mais bem passado"
              className="mt-2 w-full resize-none rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-secondary/50"
            />

            <div className="mt-5 rounded-2xl bg-accent p-4">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>{formatted.subtotal}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-lg font-bold text-primary">
                <span>Total</span>
                <span>{currency(subtotal)}</span>
              </div>
            </div>

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={clearCart}
                className="flex-1 rounded-2xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600 transition hover:border-gray-300"
              >
                Limpar
              </button>
              <button
                type="button"
                onClick={handleSubmitMesaOrder}
                disabled={
                  !selectedTargetId ||
                  !items.length ||
                  createMesaOrderMutation.isPending
                }
                className="flex-[1.4] rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-secondary disabled:opacity-50"
              >
                {createMesaOrderMutation.isPending
                  ? "Lançando..."
                  : `Lançar pedido na ${targetLabel}`}
              </button>
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}

