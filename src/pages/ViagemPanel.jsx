import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useAuth } from "../hooks/useAuth.js";
import { api } from "../lib/api.js";
import { isViagemProduct } from "../lib/productVisibility.js";

const currency = (value) =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const getProductPrice = (product) =>
  Number(
    product?.hasPriceVariants
      ? product?.pratoFeitoPrice || product?.commercialPrice
      : product?.price ?? product?.basePrice ?? product?.sizes?.[0]?.price ?? 0,
  );

const isViagemMenuProduct = (product) =>
  isViagemProduct(product) && !product.isAddon && !product.waiterOnly;

function buildMarmitaPayload(product, extraNotes = "") {
  return {
    isPickup: true,
    paymentMethod: "PAGAR_DEPOIS",
    notes: ["MARMITA", extraNotes].filter(Boolean).join(" - "),
    items: [
      {
        productId: product.id,
        quantity: 1,
        priceVariant: product.hasPriceVariants ? "PRATO_FEITO" : undefined,
        notes: "MARMITA",
      },
    ],
  };
}

export default function ViagemPanel() {
  const { logout, user } = useAuth();
  const [search, setSearch] = useState("");

  const { data: products = [], isLoading, isError } = useQuery({
    queryKey: ["viagem-products"],
    queryFn: async () => (await api.get("/products/viagem")).data?.data ?? [],
    staleTime: 5 * 60 * 1000,
  });

  const viagemProducts = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return products
      .filter(isViagemMenuProduct)
      .filter((product) => {
        if (!normalized) return true;
        return `${product.name ?? ""} ${product.category ?? ""}`
          .toLowerCase()
          .includes(normalized);
      });
  }, [products, search]);

  const createOrder = useMutation({
    mutationFn: async ({ product, total, extraNotes }) => {
      const created = await api.post(
        "/orders",
        buildMarmitaPayload(product, extraNotes),
      );
      const order = created.data?.data;

      if (total != null && order?.id) {
        await api.patch(`/orders/${order.id}/total`, { total });
      }

      return order;
    },
    onSuccess: () => {
      toast.success("Marmita lancada para a cozinha.");
    },
    onError: (error) =>
      toast.error(
        error?.response?.data?.error?.message ?? "Erro ao lancar marmita.",
      ),
  });

  return (
    <main className="min-h-screen bg-accent px-4 py-5 text-gray-900 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-4xl text-gold">Viagem</h1>
            <p className="mt-1 text-sm font-semibold text-smoke">
              Lance marmitas direto para a cozinha.
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-600"
          >
            Sair
          </button>
        </header>

        <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl text-primary">Produtos viagem</h2>
              <p className="mt-1 text-sm text-smoke">
                Ao clicar, o item entra na cozinha como marmita.
              </p>
            </div>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar prato"
              className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold outline-none transition focus:border-orange-500 sm:w-72"
            />
          </div>

          {isLoading ? (
            <div className="rounded-2xl bg-gray-50 p-8 text-center text-sm font-bold text-gray-500">
              Carregando pratos...
            </div>
          ) : isError ? (
            <div className="rounded-2xl bg-red-50 p-8 text-center text-sm font-bold text-red-600">
              Nao foi possivel carregar os produtos.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {viagemProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() =>
                    createOrder.mutate({
                      product,
                      total: null,
                      extraNotes: product.name,
                    })
                  }
                  disabled={createOrder.isPending}
                  className="rounded-2xl border border-gray-200 bg-accent/60 p-4 text-left transition hover:border-orange-500 hover:bg-orange-50 disabled:opacity-50"
                >
                  <span className="block font-display text-xl text-primary">
                    {product.name}
                  </span>
                  {product.category ? (
                    <span className="mt-1 block text-xs font-bold uppercase tracking-widest text-gray-500">
                      {product.category}
                    </span>
                  ) : null}
                  <span className="mt-4 block text-lg font-black text-orange-600">
                    {currency(getProductPrice(product))}
                  </span>
                </button>
              ))}
              {!viagemProducts.length ? (
                <div className="col-span-full rounded-2xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
                  Nenhum produto da categoria Viagem encontrado.
                </div>
              ) : null}
            </div>
          )}
        </section>

        <p className="mt-4 text-center text-xs font-semibold text-smoke">
          Logado como {user?.name ?? "Viagem"}
        </p>
      </div>
    </main>
  );
}
