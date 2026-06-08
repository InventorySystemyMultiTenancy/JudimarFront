import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useAuth } from "../hooks/useAuth.js";
import { useCart } from "../context/CartContext.jsx";
import { api } from "../lib/api.js";
import {
  isViagemPanelProduct,
  isViagemProduct,
} from "../lib/productVisibility.js";

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

const normalize = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const isDiversosProduct = (product) => normalize(product?.name).includes("diversos");

const isViagemMenuProduct = (product) =>
  isViagemPanelProduct(product) && !product.isAddon && !product.waiterOnly;

const isWaiterOnlyProduct = (product) =>
  Boolean(product?.waiterOnly) && !product?.isAddon;

function buildMarmitaPayload(items) {
  return {
    isPickup: true,
    paymentMethod: "PAGAR_DEPOIS",
    notes: "MARMITA",
    items,
  };
}

export default function ViagemPanel() {
  const { logout, user } = useAuth();
  const {
    items,
    addItem,
    updateQuantity,
    removeItem,
    clearCart,
    setCartScope,
    subtotal,
  } = useCart();
  const [customValue, setCustomValue] = useState("");
  const [sendDiversosToKitchen, setSendDiversosToKitchen] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setCartScope("viagem");
    return () => setCartScope("default");
  }, [setCartScope]);

  const { data: products = [], isLoading, isError } = useQuery({
    queryKey: ["viagem-products"],
    queryFn: async () => (await api.get("/products/viagem")).data?.data ?? [],
    staleTime: 5 * 60 * 1000,
  });

  const diversosProduct = useMemo(
    () =>
      products.find((product) => isViagemProduct(product) && isDiversosProduct(product)) ??
      null,
    [products],
  );

  const viagemProducts = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return products
      .filter(
        (product) =>
          isViagemMenuProduct(product) &&
          !isDiversosProduct(product),
      )
      .filter((product) => {
        if (!normalized) return true;
        return `${product.name ?? ""} ${product.category ?? ""}`
          .toLowerCase()
          .includes(normalized);
      });
  }, [products, search]);

  const waiterOnlyProducts = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return products
      .filter(isWaiterOnlyProduct)
      .filter((product) => {
        if (!normalized) return true;
        return `${product.name ?? ""} ${product.category ?? ""}`
          .toLowerCase()
          .includes(normalized);
      });
  }, [products, search]);

  const createOrder = useMutation({
    mutationFn: async () => {
      const orderItems = items.map((item) => ({
        productId: item.payload?.productId || item.id,
        quantity: item.quantity,
        priceVariant: item.payload?.priceVariant || undefined,
        notes: item.observation || item.payload?.notes || "MARMITA",
        manualPrice:
          item.payload?.manualPrice != null
            ? Number(item.payload.manualPrice)
            : undefined,
        deliverImmediately: item.payload?.deliverImmediately === true,
      }));

      const created = await api.post("/orders", buildMarmitaPayload(orderItems));
      return created.data?.data;
    },
    onSuccess: () => {
      clearCart();
      setCustomValue("");
      toast.success("Pedido viagem enviado.");
    },
    onError: (error) =>
      toast.error(
        error?.response?.data?.error?.message ?? "Erro ao lancar marmita.",
      ),
  });

  const addProductToCart = (product) => {
    addItem({
      key: `viagem-${product.id}`,
      id: product.id,
      nome: product.name,
      price: getProductPrice(product),
      priceVariant: product.hasPriceVariants ? "PRATO_FEITO" : undefined,
      priceVariantLabel: product.hasPriceVariants ? "Prato feito" : "",
      quantity: 1,
      observation: "MARMITA",
      payload: {
        productId: product.id,
        priceVariant: product.hasPriceVariants ? "PRATO_FEITO" : undefined,
        notes: "MARMITA",
        deliverImmediately: false,
      },
    });
  };

  const addWaiterOnlyToCart = (product) => {
    addItem({
      key: `viagem-garcom-${product.id}`,
      id: product.id,
      nome: product.name,
      price: getProductPrice(product),
      quantity: 1,
      observation: "MARMITA - JA ENTREGUE",
      payload: {
        productId: product.id,
        notes: "MARMITA - JA ENTREGUE",
        deliverImmediately: true,
      },
    });
  };

  const handleAddDiversosToCart = (event) => {
    event.preventDefault();

    if (!diversosProduct) {
      toast.error("Cadastre um produto da categoria Viagem chamado Diversos.");
      return;
    }

    const total = Number(String(customValue).replace(",", "."));
    if (!Number.isFinite(total) || total <= 0) {
      toast.error("Informe o valor do Diversos.");
      return;
    }

    addItem({
      key: [
        "viagem-diversos",
        diversosProduct.id,
        total.toFixed(2),
        sendDiversosToKitchen ? "cozinha" : "entregue",
      ].join("|"),
      id: diversosProduct.id,
      nome: diversosProduct.name ?? "Diversos",
      price: total,
      quantity: 1,
      observation: [
        "MARMITA",
        `DIVERSOS ${currency(total)}`,
        sendDiversosToKitchen ? "" : "JA ENTREGUE",
      ]
        .filter(Boolean)
        .join(" - "),
      payload: {
        productId: diversosProduct.id,
        manualPrice: total,
        notes: "MARMITA",
        deliverImmediately: !sendDiversosToKitchen,
      },
    });
    setCustomValue("");
  };

  const handleSubmitCart = () => {
    if (!items.length) {
      toast.error("Adicione itens ao carrinho.");
      return;
    }
    createOrder.mutate();
  };

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

        <section className="mb-5 rounded-3xl border border-orange-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-orange-600">
                Lancamento rapido
              </p>
              <h2 className="mt-1 font-display text-2xl text-primary">
                {diversosProduct?.name ?? "Diversos"}
              </h2>
            </div>
            <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-black uppercase text-orange-700">
              Viagem
            </span>
          </div>
          <form
            onSubmit={handleAddDiversosToCart}
            className="grid gap-3 lg:grid-cols-[1fr_auto_auto]"
          >
            <input
              type="number"
              min="0"
              step="0.01"
              value={customValue}
              onChange={(event) => setCustomValue(event.target.value)}
              placeholder="Digite o valor"
              className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-lg font-black outline-none transition focus:border-orange-500"
            />
            <label className="flex min-h-14 items-center gap-3 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm font-black uppercase text-orange-800">
              <input
                type="checkbox"
                checked={sendDiversosToKitchen}
                onChange={(event) => setSendDiversosToKitchen(event.target.checked)}
                className="h-5 w-5 rounded border-orange-300 text-orange-600 focus:ring-orange-500"
              />
              Cozinha
            </label>
            <button
              type="submit"
              disabled={createOrder.isPending}
              className="rounded-2xl bg-orange-600 px-6 py-4 text-sm font-black uppercase text-white transition hover:bg-orange-700 disabled:opacity-50"
            >
              Adicionar ao carrinho
            </button>
          </form>
        </section>

        <section className="mb-5 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl text-primary">Carrinho</h2>
              <p className="mt-1 text-sm text-smoke">
                Revise os itens antes de enviar para a cozinha.
              </p>
            </div>
            <span className="text-xl font-black text-orange-600">
              {currency(subtotal)}
            </span>
          </div>

          {items.length ? (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.key}
                  className="flex flex-wrap items-center gap-3 rounded-2xl border border-orange-100 bg-orange-50 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-black text-primary">{item.nome}</p>
                    <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                      {item.payload?.deliverImmediately ? "Ja entregue" : "Cozinha"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.key, item.quantity - 1)}
                      className="h-9 w-9 rounded-full border border-orange-200 bg-white text-lg font-black text-primary"
                    >
                      -
                    </button>
                    <span className="w-6 text-center text-sm font-black">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.key, item.quantity + 1)}
                      className="h-9 w-9 rounded-full border border-orange-200 bg-white text-lg font-black text-primary"
                    >
                      +
                    </button>
                  </div>
                  <span className="w-24 text-right text-sm font-black text-orange-600">
                    {currency(Number(item.price || 0) * item.quantity)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(item.key)}
                    className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black uppercase text-red-600"
                  >
                    Remover
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm font-semibold text-gray-500">
              Nenhum item no carrinho.
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={clearCart}
              disabled={!items.length || createOrder.isPending}
              className="rounded-2xl border border-gray-200 px-5 py-3 text-sm font-black uppercase text-gray-600 transition hover:border-gray-300 disabled:opacity-50"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={handleSubmitCart}
              disabled={!items.length || createOrder.isPending}
              className="flex-1 rounded-2xl bg-orange-600 px-6 py-3 text-sm font-black uppercase text-white transition hover:bg-orange-700 disabled:opacity-50"
            >
              {createOrder.isPending ? "Enviando..." : "Enviar pedido"}
            </button>
          </div>
        </section>

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
                  onClick={() => addProductToCart(product)}
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

        <section className="mt-5 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="font-display text-2xl text-primary">Somente garçom</h2>
            <p className="mt-1 text-sm text-smoke">
              Itens desta seção entram no carrinho como já entregues.
            </p>
          </div>

          {isLoading ? (
            <div className="rounded-2xl bg-gray-50 p-8 text-center text-sm font-bold text-gray-500">
              Carregando itens...
            </div>
          ) : isError ? (
            <div className="rounded-2xl bg-red-50 p-8 text-center text-sm font-bold text-red-600">
              Nao foi possivel carregar os itens.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {waiterOnlyProducts.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addWaiterOnlyToCart(product)}
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
              {!waiterOnlyProducts.length ? (
                <div className="col-span-full rounded-2xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">
                  Nenhum item somente garçom encontrado.
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
