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

function MenuCard({ product }) {
  const { t } = useTranslation();
  const name = t(`PRODUCT_${String(product.id ?? "")}_NAME`, product.name);
  const description = t(
    `PRODUCT_${String(product.id ?? "")}_DESC`,
    product.description ?? "",
  );
  const isOutOfStock = product.stock === 0;

  return (
    <article
      className={`flex flex-col overflow-hidden rounded-3xl border bg-white p-4 shadow-sm transition ${
        isOutOfStock ? "opacity-60" : "hover:shadow-md"
      }`}
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h3 className="font-display text-base font-semibold text-gray-900">
            {name}
          </h3>
          {description && (
            <p className="mt-2 text-sm leading-relaxed text-gray-600 line-clamp-3">
              {description}
            </p>
          )}
        </div>
        <span className="text-sm font-semibold text-secondary">
          {fmt(getProductPrice(product))}
        </span>
      </div>
      {isOutOfStock && (
        <div className="rounded-2xl bg-red-50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-red-700">
          {t("ESGOTADO", "Esgotado")}
        </div>
      )}
    </article>
  );
}

function MesaCardapioPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [search, setSearch] = useState("");

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
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="border-b border-slate-200 bg-primary py-8 text-center text-white">
        <p className="text-xs uppercase tracking-[0.25em] text-white/70">
          {t("MESA_CARDAPIO_SUBTITLE", "Cardápio da mesa")}
        </p>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
          {t("MESA_CARDAPIO_TITLE", "Veja nosso cardápio")}
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-white/80">
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
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
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
              className="w-full rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-secondary/60 focus:ring-2 focus:ring-secondary/20 sm:w-72"
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
              <MenuCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      <div className="fixed bottom-4 right-4 z-40">
        <ChamarGarcomButton />
      </div>
    </main>
  );
}

export default MesaCardapioPage;
