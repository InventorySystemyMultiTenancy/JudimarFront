import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function toPositiveInt(value, fallback = 1) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export default function AdminPurchaseProductsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [observation, setObservation] = useState("");
  const [selectedByProduct, setSelectedByProduct] = useState({});

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["admin-purchase-products"],
    queryFn: async () => {
      const res = await api.get("/admin/products");
      return res.data?.data ?? [];
    },
    staleTime: 60_000,
  });

  const { data: pendingLists = [] } = useQuery({
    queryKey: ["admin-purchase-pending-lists"],
    queryFn: async () => {
      const res = await api.get("/admin/purchase-lists/pending");
      return res.data?.data ?? [];
    },
  });

  const activeProducts = useMemo(
    () => products.filter((product) => product.isActive),
    [products],
  );

  const enrichedProducts = useMemo(
    () =>
      activeProducts.map((product) => {
        const stock = Number(product.stock ?? 0);
        const stockMinimum = Number(product.stockMinimum ?? 0);
        const toBuy = Math.max(stockMinimum - stock, 0);
        return {
          ...product,
          stock,
          stockMinimum,
          toBuy,
        };
      }),
    [activeProducts],
  );

  const categories = useMemo(() => {
    const set = new Set();
    for (const product of enrichedProducts) {
      if (product.category) set.add(product.category);
    }
    return [...set];
  }, [enrichedProducts]);

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enrichedProducts.filter((product) => {
      if (categoryFilter && product.category !== categoryFilter) return false;
      if (!q) return true;
      return `${product.name} ${product.category ?? ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [enrichedProducts, search, categoryFilter]);

  const selectedEntries = useMemo(() => {
    return Object.entries(selectedByProduct)
      .map(([productId, quantity]) => ({
        productId,
        quantity: toPositiveInt(quantity),
      }))
      .filter((entry) => entry.quantity > 0);
  }, [selectedByProduct]);

  const createPendingMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEntries.length) {
        throw new Error("Selecione ao menos um produto.");
      }
      const res = await api.post("/admin/purchase-lists/pending", {
        items: selectedEntries,
        observation: observation.trim() || undefined,
      });
      return res.data?.data;
    },
    onSuccess: () => {
      toast.success("Lista pendente salva.");
      queryClient.invalidateQueries({
        queryKey: ["admin-purchase-pending-lists"],
      });
      setSelectedByProduct({});
      setObservation("");
      setTimeout(() => {
        window.print();
      }, 120);
    },
    onError: (error) => {
      toast.error(
        error?.response?.data?.error?.message ||
          error?.message ||
          "Erro ao salvar lista pendente.",
      );
    },
  });

  const confirmPendingMutation = useMutation({
    mutationFn: async (listId) => {
      const res = await api.post(
        `/admin/purchase-lists/pending/${listId}/confirm`,
      );
      return res.data;
    },
    onSuccess: () => {
      toast.success("Abastecimento confirmado e estoque atualizado.");
      queryClient.invalidateQueries({ queryKey: ["admin-purchase-products"] });
      queryClient.invalidateQueries({
        queryKey: ["admin-purchase-pending-lists"],
      });
      queryClient.invalidateQueries({ queryKey: ["admin-stock-products"] });
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["admin-low-stock-products"] });
    },
    onError: (error) => {
      toast.error(
        error?.response?.data?.error?.message ||
          "Erro ao confirmar abastecimento.",
      );
    },
  });

  const toggleProduct = (product) => {
    setSelectedByProduct((prev) => {
      if (product.id in prev) {
        const next = { ...prev };
        delete next[product.id];
        return next;
      }
      return {
        ...prev,
        [product.id]: String(product.toBuy > 0 ? product.toBuy : 1),
      };
    });
  };

  const setQuantity = (productId, value) => {
    setSelectedByProduct((prev) => ({
      ...prev,
      [productId]: value,
    }));
  };

  const selectAllBelowMinimum = () => {
    const next = {};
    for (const product of enrichedProducts) {
      if (product.toBuy > 0) {
        next[product.id] = String(product.toBuy);
      }
    }
    setSelectedByProduct(next);
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-6 text-gray-900 sm:px-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            to="/admin/produtos"
            className="text-xs text-gold/70 transition hover:text-gold"
          >
            ← Produtos
          </Link>
          <h1 className="mt-1 font-display text-3xl text-gold">
            Produtos a Comprar
          </h1>
          <p className="mt-1 text-sm text-smoke">
            O sistema calcula o déficit por estoque mínimo e você ajusta a
            quantidade a levar antes de imprimir.
          </p>
        </div>
        <button
          type="button"
          onClick={selectAllBelowMinimum}
          className="rounded-xl border border-gold/30 px-3 py-2 text-xs font-semibold text-gold transition hover:bg-gold/10"
        >
          Selecionar todos abaixo do mínimo
        </button>
      </header>

      <section className="rounded-3xl border border-gold/20 bg-lacquer/70 p-4 sm:p-6">
        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar produto..."
            className="rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-gold/40"
          />
          <input
            value={observation}
            onChange={(event) => setObservation(event.target.value)}
            placeholder="Observação da lista (opcional)"
            className="rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-gold/40"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategoryFilter("")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              categoryFilter === ""
                ? "bg-gold text-[#11161d]"
                : "border border-gray-200 bg-white text-smoke"
            }`}
          >
            Todas
          </button>
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() =>
                setCategoryFilter((prev) => (prev === category ? "" : category))
              }
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                categoryFilter === category
                  ? "bg-gold text-[#11161d]"
                  : "border border-gray-200 bg-white text-smoke"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {isLoading ? (
          <p className="mt-6 text-sm text-smoke">Carregando produtos...</p>
        ) : (
          <div className="mt-4 grid gap-3">
            {visibleProducts.map((product) => {
              const selected = product.id in selectedByProduct;
              return (
                <label
                  key={product.id}
                  className={`grid cursor-pointer items-center gap-3 rounded-2xl border p-3 transition md:grid-cols-[auto_1fr_auto_auto_auto] ${
                    selected
                      ? "border-gold/40 bg-gold/5"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleProduct(product)}
                    className="h-4 w-4 accent-amber-500"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">
                      {product.name}
                    </p>
                    <p className="text-xs text-smoke">
                      {product.category ?? "Geral"}
                    </p>
                  </div>
                  <p className="text-xs text-smoke">
                    Atual: <strong>{product.stock}</strong>
                  </p>
                  <p className="text-xs text-smoke">
                    Mínimo: <strong>{product.stockMinimum}</strong>
                  </p>
                  <p
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      product.toBuy > 0
                        ? "bg-amber-100 text-amber-700"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    Comprar: {product.toBuy}
                  </p>
                </label>
              );
            })}
            {!visibleProducts.length ? (
              <div className="rounded-2xl border border-dashed border-gray-300 p-4 text-sm text-smoke">
                Nenhum produto encontrado.
              </div>
            ) : null}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-3xl border border-gold/20 bg-lacquer/70 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl text-gold">
            Lista para imprimir
          </h2>
          <button
            type="button"
            onClick={() => createPendingMutation.mutate()}
            disabled={
              !selectedEntries.length || createPendingMutation.isPending
            }
            className="rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 px-4 py-2 text-sm font-bold text-[#11161d] transition hover:opacity-90 disabled:opacity-50"
          >
            {createPendingMutation.isPending
              ? "Salvando..."
              : "Salvar pendente e imprimir"}
          </button>
        </div>

        <ul className="mt-4 space-y-2">
          {selectedEntries.map((entry) => {
            const product = enrichedProducts.find(
              (p) => p.id === entry.productId,
            );
            return (
              <li
                key={entry.productId}
                className="grid gap-2 rounded-2xl border border-gray-200 bg-white p-3 md:grid-cols-[1fr_auto] md:items-center"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {product?.name ?? entry.productId}
                  </p>
                  <p className="text-xs text-smoke">
                    Estoque atual: {product?.stock ?? 0} · mínimo:{" "}
                    {product?.stockMinimum ?? 0}
                  </p>
                </div>
                <input
                  type="number"
                  min="1"
                  value={selectedByProduct[entry.productId]}
                  onChange={(event) =>
                    setQuantity(entry.productId, event.target.value)
                  }
                  className="w-24 rounded-xl border border-gray-300 px-2 py-1 text-right text-sm outline-none focus:border-gold/40"
                />
              </li>
            );
          })}
          {!selectedEntries.length ? (
            <li className="rounded-2xl border border-dashed border-gray-300 p-4 text-sm text-smoke">
              Selecione produtos para montar a lista de compra.
            </li>
          ) : null}
        </ul>
      </section>

      <section className="mt-6 rounded-3xl border border-gold/20 bg-lacquer/70 p-4 sm:p-6">
        <h2 className="font-display text-xl text-gold">Listas pendentes</h2>
        <p className="mt-1 text-xs text-smoke">
          Após a entrega física dos produtos, confirme o abastecimento para
          lançar entrada no estoque e remover a pendência.
        </p>

        <div className="mt-4 space-y-3">
          {pendingLists.map((list) => (
            <article
              key={list.id}
              className="rounded-2xl border border-gray-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Lista {list.id.slice(0, 8)}
                  </p>
                  <p className="text-xs text-smoke">
                    {formatDate(list.createdAt)}
                    {list.observation ? ` · ${list.observation}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={confirmPendingMutation.isPending}
                  onClick={() => confirmPendingMutation.mutate(list.id)}
                  className="rounded-xl border border-emerald-400/40 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
                >
                  Confirmar abastecimento
                </button>
              </div>

              <ul className="mt-3 space-y-1">
                {(list.items ?? []).map((item) => (
                  <li
                    key={item.id}
                    className="flex justify-between gap-3 text-xs text-gray-700"
                  >
                    <span>{item.productName}</span>
                    <span>
                      Levar <strong>{item.quantity}</strong> un · atual{" "}
                      {item.stock}
                    </span>
                  </li>
                ))}
              </ul>
            </article>
          ))}

          {!pendingLists.length ? (
            <div className="rounded-2xl border border-dashed border-gray-300 p-4 text-sm text-smoke">
              Nenhuma lista pendente no momento.
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
