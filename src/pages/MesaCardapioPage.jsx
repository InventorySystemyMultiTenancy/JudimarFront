import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";
import { useAuth } from "../hooks/useAuth.js";
import { useTranslation } from "../context/I18nContext.jsx";
import ChamarGarcomButton from "../components/ChamarGarcomButton.jsx";

const fmt = (value) =>
  Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const getProductPrice = (product) =>
  Number(product?.price ?? product?.sizes?.[0]?.price ?? 0);

function MenuCard({ product, onClick }) {
  const { t } = useTranslation();
  const name = t(`PRODUCT_${String(product.id ?? "")}_NAME`, product.name);
  const description = t(
    `PRODUCT_${String(product.id ?? "")}_DESC`,
    product.description ?? "",
  );
  const imageUrl = product.imageUrl || product.image || product.photo || "";
  const isOutOfStock = product.stock === 0;
  const clickable = Boolean(imageUrl);

  return (
    <article
      onClick={() => clickable && onClick(product)}
      className={`flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-[#fff9f0] p-4 shadow-sm transition ${
        isOutOfStock
          ? "opacity-60"
          : "hover:shadow-lg hover:shadow-slate-200/40"
      } ${clickable ? "cursor-pointer" : "cursor-default"}`}
    >
      <div className="mb-4 flex items-start gap-4">
        {imageUrl ? (
          <div className="relative">
            <img
              src={imageUrl}
              alt={name}
              className="h-20 w-20 rounded-3xl object-cover"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
            <div className="pointer-events-none absolute inset-0 rounded-3xl bg-slate-950/0 transition hover:bg-slate-950/10" />
          </div>
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-100 text-2xl text-slate-400">
            🍽
          </div>
        )}
        <div className="flex-1">
          <h3 className="font-display text-base font-semibold text-gray-900">
            {name}
          </h3>
          {description && (
            <p className="mt-2 text-sm leading-relaxed text-gray-600 line-clamp-3">
              {description}
            </p>
          )}
          <span className="mt-3 block text-sm font-semibold text-secondary">
            {fmt(getProductPrice(product))}
          </span>
        </div>
      </div>
      {isOutOfStock && (
        <div className="rounded-2xl bg-red-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-red-700">
          {t("ESGOTADO", "Esgotado")}
        </div>
      )}
      {clickable && (
        <p className="mt-4 text-xs text-slate-500">
          {t("MESA_CARDAPIO_CLICK_IMAGE", "Clique para ver a imagem maior")}
        </p>
      )}
    </article>
  );
}

function MesaCardapioPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const res = await api.get("/products");
      return res.data?.data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const categories = [
    ...new Set(products.map((product) => product.category ?? "Geral")),
  ];
  const ALL_LABEL = t("CARDAPIO_CAT_ALL", "Todos");
  const categoryOptions = [ALL_LABEL, ...categories];
  const normalizedSearch = search.trim().toLowerCase();

  const filteredByCategory =
    activeCategory === ALL_LABEL
      ? products
      : products.filter(
          (product) =>
            (product.category ?? "Geral").toLowerCase() ===
            activeCategory.toLowerCase(),
        );

  const filtered = normalizedSearch
    ? filteredByCategory.filter((product) =>
        [product.name, product.description, product.category]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(normalizedSearch)),
      )
    : filteredByCategory;

  return (
    <main className="min-h-screen bg-[#f4e7d3] text-slate-900">
      <div className="border-b border-slate-200 bg-[#dac2a1] py-10 text-center text-slate-950 shadow-sm shadow-slate-200/30">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-800/70">
          {t("MESA_CARDAPIO_SUBTITLE", "Cardápio da mesa")}
        </p>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
          {t("MESA_CARDAPIO_TITLE", "Veja nosso cardápio")}
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-800/80">
          {t(
            "MESA_CARDAPIO_DESCRIPTION",
            "Acesse e veja os pratos disponíveis. Aqui não é possível adicionar ao carrinho — apenas visualizar e chamar o atendente.",
          )}
        </p>
      </div>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {categoryOptions.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  activeCategory === category
                    ? "border-secondary bg-secondary/10 text-secondary"
                    : "border-slate-200 bg-[#fff7ed] text-slate-900 hover:border-slate-300"
                }`}
              >
                {category}
              </button>
            ))}
          </div>

          <label className="relative block w-full sm:w-auto">
            <span className="sr-only">Buscar</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("MESA_CARDAPIO_SEARCH", "Buscar no cardápio...")}
              className="w-full rounded-full border border-slate-200 bg-[#fff7ed] px-4 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-secondary/60 focus:ring-2 focus:ring-secondary/20 sm:w-72"
            />
          </label>
        </div>

        {isLoading ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
            {t("LOADING", "Carregando...")}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((product) => (
              <MenuCard
                key={product.id}
                product={product}
                onClick={setSelectedProduct}
              />
            ))}
          </div>
        )}
      </section>

      {selectedProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-[2rem] bg-[#fff9f0] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedProduct(null)}
              className="absolute right-4 top-4 rounded-full bg-slate-950/80 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-900"
            >
              {t("FECHAR", "Fechar")}
            </button>
            <img
              src={
                selectedProduct.imageUrl ||
                selectedProduct.image ||
                selectedProduct.photo ||
                ""
              }
              alt={t(
                `PRODUCT_${String(selectedProduct.id ?? "")}_NAME`,
                selectedProduct.name,
              )}
              className="max-h-[85vh] w-full object-contain bg-slate-100"
            />
            <div className="space-y-3 p-6">
              <h2 className="text-2xl font-semibold text-slate-950">
                {t(
                  `PRODUCT_${String(selectedProduct.id ?? "")}_NAME`,
                  selectedProduct.name,
                )}
              </h2>
              {selectedProduct.description && (
                <p className="text-sm leading-relaxed text-slate-700">
                  {t(
                    `PRODUCT_${String(selectedProduct.id ?? "")}_DESC`,
                    selectedProduct.description,
                  )}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="fixed bottom-4 right-4 z-40">
        <ChamarGarcomButton />
      </div>
    </main>
  );
}

export default MesaCardapioPage;
