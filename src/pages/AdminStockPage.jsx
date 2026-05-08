import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";

const currency = (v) =>
  Number(v || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

function StockMovementModal({ products, onClose, onSuccess }) {
  const queryClient = useQueryClient();
  const [type, setType] = useState("ENTRADA");
  const [observation, setObservation] = useState("");
  const [selected, setSelected] = useState({}); // { [productId]: quantity string }
  const [search, setSearch] = useState("");

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) =>
      `${p.name} ${p.category ?? ""}`.toLowerCase().includes(q),
    );
  }, [products, search]);

  const toggleProduct = (id) => {
    setSelected((prev) => {
      if (id in prev) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: "1" };
    });
  };

  const setQty = (id, val) => {
    setSelected((prev) => ({ ...prev, [id]: val }));
  };

  const selectedEntries = Object.entries(selected);

  const mutation = useMutation({
    mutationFn: async () => {
      const items = selectedEntries
        .map(([productId, qty]) => ({
          productId,
          quantity: Math.max(1, parseInt(qty, 10) || 1),
        }))
        .filter((i) => i.quantity > 0);

      if (!items.length) throw new Error("Selecione ao menos um produto.");

      const res = await api.post("/admin/stock/movements", {
        items,
        type,
        observation: observation.trim() || undefined,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success(
        type === "ENTRADA"
          ? "Entrada de estoque registrada!"
          : "Saída de estoque registrada!",
      );
      queryClient.invalidateQueries({ queryKey: ["admin-stock-products"] });
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      onSuccess?.();
      onClose();
    },
    onError: (err) => {
      toast.error(
        err?.response?.data?.error?.message ||
          err?.message ||
          "Erro ao registrar movimentação.",
      );
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4">
      <div className="fixed inset-0 bg-black/70" onClick={onClose} />
      <div className="relative z-10 my-auto w-full max-w-2xl rounded-3xl border border-gold/20 bg-white p-6 shadow-2xl">
        <h2 className="font-display text-2xl text-[#11161d]">
          📦 Movimentação de Estoque
        </h2>

        {/* Tipo */}
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={() => setType("ENTRADA")}
            className={`flex-1 rounded-2xl border py-3 text-sm font-bold transition ${
              type === "ENTRADA"
                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                : "border-gray-200 text-gray-500 hover:border-emerald-300"
            }`}
          >
            ↓ Entrada
          </button>
          <button
            type="button"
            onClick={() => setType("SAIDA")}
            className={`flex-1 rounded-2xl border py-3 text-sm font-bold transition ${
              type === "SAIDA"
                ? "border-red-400 bg-red-50 text-red-600"
                : "border-gray-200 text-gray-500 hover:border-red-300"
            }`}
          >
            ↑ Saída
          </button>
        </div>

        {/* Observação */}
        <div className="mt-4">
          <label className="mb-1 block text-xs uppercase tracking-widest text-gray-500">
            Observação
          </label>
          <input
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            placeholder="Ex: Recebimento fornecedor, ajuste de inventário..."
            className="w-full rounded-2xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-amber-400"
          />
        </div>

        {/* Busca */}
        <div className="mt-4">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar produto..."
            className="w-full rounded-2xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-amber-400"
          />
        </div>

        {/* Lista de produtos */}
        <div className="mt-3 max-h-72 overflow-y-auto rounded-2xl border border-gray-200">
          {filteredProducts.map((p) => {
            const isChecked = p.id in selected;
            return (
              <label
                key={p.id}
                className={`flex cursor-pointer items-center gap-3 border-b border-gray-100 px-4 py-3 last:border-0 transition hover:bg-gray-50 ${
                  isChecked ? "bg-amber-50" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleProduct(p.id)}
                  className="h-4 w-4 accent-amber-500"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-800">
                    {p.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    {p.category ?? "Geral"} · Estoque atual:{" "}
                    <strong>{p.stock ?? 0}</strong>
                  </p>
                </div>
                {isChecked && (
                  <input
                    type="number"
                    min="1"
                    value={selected[p.id]}
                    onChange={(e) => setQty(p.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-20 rounded-xl border border-gray-300 px-2 py-1 text-center text-sm outline-none focus:border-amber-400"
                    placeholder="Qtd"
                  />
                )}
              </label>
            );
          })}
          {filteredProducts.length === 0 && (
            <p className="p-6 text-center text-sm text-gray-400">
              Nenhum produto encontrado.
            </p>
          )}
        </div>

        {/* Resumo selecionados */}
        {selectedEntries.length > 0 && (
          <div className="mt-3 rounded-2xl bg-gray-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
              Resumo da movimentação ({type === "ENTRADA" ? "Entrada" : "Saída"}
              )
            </p>
            <ul className="mt-2 space-y-1">
              {selectedEntries.map(([pid, qty]) => {
                const prod = products.find((p) => p.id === pid);
                return (
                  <li
                    key={pid}
                    className="flex justify-between text-xs text-gray-700"
                  >
                    <span>{prod?.name ?? pid}</span>
                    <span className="font-semibold">
                      {type === "ENTRADA" ? "+" : "-"}
                      {parseInt(qty, 10) || 1} un
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl border border-gray-200 py-3 text-sm text-gray-600 transition hover:border-gray-400"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={selectedEntries.length === 0 || mutation.isPending}
            onClick={() => mutation.mutate()}
            className={`flex-1 rounded-2xl py-3 text-sm font-bold transition disabled:opacity-50 ${
              type === "ENTRADA"
                ? "bg-emerald-500 text-white hover:bg-emerald-600"
                : "bg-red-500 text-white hover:bg-red-600"
            }`}
          >
            {mutation.isPending
              ? "Salvando..."
              : `Confirmar ${type === "ENTRADA" ? "Entrada" : "Saída"}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminStockPage() {
  const [showMovement, setShowMovement] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["admin-stock-products"],
    queryFn: async () => {
      const res = await api.get("/admin/products");
      return res.data?.data ?? [];
    },
    staleTime: 60_000,
  });

  const activeProducts = useMemo(
    () => products.filter((p) => p.isActive),
    [products],
  );

  const categories = useMemo(() => {
    const seen = new Set();
    for (const p of activeProducts) {
      if (p.category) seen.add(p.category);
    }
    return [...seen];
  }, [activeProducts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return activeProducts.filter((p) => {
      if (categoryFilter && p.category !== categoryFilter) return false;
      if (q && !`${p.name} ${p.category ?? ""}`.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [activeProducts, search, categoryFilter]);

  const lowStockCount = useMemo(
    () => activeProducts.filter((p) => (p.stock ?? 0) < 5).length,
    [activeProducts],
  );

  return (
    <div className="min-h-screen bg-[#11161d] px-4 py-10">
      <div className="mx-auto max-w-4xl">
        {/* Breadcrumb */}
        <div className="mb-2 flex items-center gap-2 text-xs text-gold/60">
          <Link to="/admin" className="transition hover:text-gold">
            Painel Admin
          </Link>
          <span>/</span>
          <Link to="/admin/produtos" className="transition hover:text-gold">
            Produtos
          </Link>
          <span>/</span>
          <span className="text-gold">Estoque</span>
        </div>

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl text-gold">
              📦 Gerenciar Estoque
            </h1>
            <p className="mt-1 text-sm text-smoke">
              Saldo atual de cada produto.{" "}
              {lowStockCount > 0 && (
                <span className="font-semibold text-red-400">
                  {lowStockCount} produto(s) com estoque baixo (&lt; 5 un).
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowMovement(true)}
            className="rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 px-5 py-3 text-sm font-bold text-[#11161d] shadow-lg transition hover:opacity-90"
          >
            + Movimentação de Estoque
          </button>
        </div>

        {/* Filters */}
        <div className="mt-6 flex flex-wrap gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar produto..."
            className="flex-1 rounded-2xl border border-gold/20 bg-lacquer px-4 py-2.5 text-sm text-white outline-none placeholder:text-smoke focus:border-gold/50"
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategoryFilter("")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              categoryFilter === ""
                ? "bg-gold text-[#11161d]"
                : "bg-lacquer text-smoke hover:text-gold"
            }`}
          >
            Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() =>
                setCategoryFilter((prev) => (prev === cat ? "" : cat))
              }
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                categoryFilter === cat
                  ? "bg-gold text-[#11161d]"
                  : "bg-lacquer text-smoke hover:text-gold"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="mt-10 text-center text-sm text-smoke">
            Carregando...
          </div>
        ) : (
          <div className="mt-6 overflow-hidden rounded-3xl border border-gold/20 bg-lacquer">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gold/10 text-xs uppercase tracking-widest text-smoke">
                  <th className="px-5 py-3 text-left">Produto</th>
                  <th className="px-5 py-3 text-left">Categoria</th>
                  <th className="px-5 py-3 text-right">Preço</th>
                  <th className="px-5 py-3 text-right">Estoque</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const price = p.sizes?.[0]?.price ?? p.price;
                  const stock = p.stock ?? 0;
                  const isLow = stock < 5;
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-gold/5 transition last:border-0 hover:bg-gold/5"
                    >
                      <td className="flex items-center gap-3 px-5 py-3">
                        {p.imageUrl ? (
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            className="h-10 w-10 flex-shrink-0 rounded-xl object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gold/10 text-lg">
                            🍽
                          </div>
                        )}
                        <span className="font-semibold text-white">
                          {p.name}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-smoke">
                        {p.category ?? "Geral"}
                      </td>
                      <td className="px-5 py-3 text-right text-smoke">
                        {price != null ? currency(price) : "—"}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            isLow
                              ? "bg-red-900/40 text-red-400"
                              : "bg-emerald-900/30 text-emerald-400"
                          }`}
                        >
                          {stock} un
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-10 text-center text-sm text-smoke"
                    >
                      Nenhum produto encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showMovement && (
        <StockMovementModal
          products={activeProducts}
          onClose={() => setShowMovement(false)}
        />
      )}
    </div>
  );
}
