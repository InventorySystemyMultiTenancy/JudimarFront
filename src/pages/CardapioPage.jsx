import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import CartDrawer from "../components/CartDrawer.jsx";
import ChamarGarcomButton from "../components/ChamarGarcomButton.jsx";
import Navbar from "../components/Navbar.jsx";
import ProductCustomizer from "../components/ProductCustomizer.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { api } from "../lib/api.js";
import { useTranslation } from "../context/I18nContext.jsx";

const fmt = (value) =>
  Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const getProductPrice = (product) =>
  Number(
    product?.price ?? product?.basePrice ?? product?.sizes?.[0]?.price ?? 0,
  );

function tProductField(t, productId, field, fallback) {
  const id = String(productId ?? "");
  return t(
    `PRODUCT_${id}_${field}`,
    t(`PRODUCT_${id.toUpperCase()}_${field}`, fallback),
  );
}

const ACOMP_KEYWORDS = [
  "arroz",
  "feijão",
  "salada",
  "fritas",
  "legumes",
  "farofa",
  "couve",
];

function parseAcompanhamentos(description) {
  if (!description) return { main: description, acomp: null };
  const lower = description.toLowerCase();
  if (!ACOMP_KEYWORDS.some((k) => lower.includes(k)))
    return { main: description, acomp: null };
  const match = description.match(/^(.*?)\s*[.;,]?\s*(acompanha.*)/i);
  if (match) return { main: match[1].trim(), acomp: match[2].trim() };
  const parts = description.split(/\.\s+/);
  if (parts.length > 1)
    return { main: parts[0].trim(), acomp: parts.slice(1).join(". ").trim() };
  return { main: description, acomp: null };
}

function MenuCard({ product, featured }) {
  const [showCustomizer, setShowCustomizer] = useState(false);
  const { t } = useTranslation();
  const productName = tProductField(t, product.id, "NAME", product.name);
  const rawDesc = product.description
    ? tProductField(t, product.id, "DESC", product.description)
    : null;
  const { main: productDesc, acomp } = parseAcompanhamentos(rawDesc);

  return (
    <>
      <article
        className="relative flex overflow-hidden rounded-lg border border-border-soft bg-white shadow-card transition cursor-pointer hover:shadow-card-hover hover:border-secondary/40"
        onClick={() => setShowCustomizer(true)}
      >
        <div className="absolute left-2 top-2 z-10 flex flex-col gap-1">
          {featured && (
            <span className="rounded bg-secondary px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-widest text-white shadow">
              &#9733; {t("FEATURED_LABEL", "Destaque")}
            </span>
          )}
        </div>

        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={productName}
            className="h-24 w-24 shrink-0 object-cover sm:h-28 sm:w-28"
            onError={(e) => (e.currentTarget.style.display = "none")}
          />
        ) : (
          <div className="flex h-24 w-24 shrink-0 items-center justify-center bg-accent text-2xl sm:h-28 sm:w-28">
            &#127869;
          </div>
        )}

        <div className="flex flex-1 flex-col justify-between p-3 sm:p-4">
          <div>
            <h3 className="font-display text-sm font-semibold text-primary line-clamp-1 sm:text-[0.95rem]">
              {productName}
            </h3>
            {productDesc && (
              <p className="mt-0.5 text-xs leading-relaxed text-text-muted line-clamp-1">
                {productDesc}
              </p>
            )}
            {acomp && (
              <p className="mt-0.5 text-[0.68rem] leading-relaxed text-text-muted/75 italic line-clamp-1">
                {acomp}
              </p>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="font-body text-sm font-bold text-secondary">
              {fmt(getProductPrice(product))}
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowCustomizer(true);
              }}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-white text-sm font-bold shadow-sm transition hover:bg-secondary"
              aria-label="Adicionar"
            >
              +
            </button>
          </div>
        </div>
      </article>

      {showCustomizer && (
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
      )}
    </>
  );
}

const CATEGORY_ORDER = [
  "espetinho",
  "porcao",
  "porcões",
  "refeicao",
  "prato feito",
  "comercial",
  "executivo",
  "lanche",
  "combo",
  "bebida",
  "dose",
  "sobremesa",
];

function CardapioPage() {
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [search, setSearch] = useState("");
  const { user } = useAuth();
  const { t } = useTranslation();

  const { data: mesaOrders = [] } = useQuery({
    queryKey: ["mesa-orders"],
    queryFn: async () => {
      const res = await api.get("/mesa/orders");
      return res.data?.data ?? [];
    },
    enabled: user?.role === "MESA",
    refetchInterval: 30000,
  });

  const pendingTotal =
    user?.role === "MESA"
      ? mesaOrders
          .filter(
            (o) => o.paymentStatus !== "APROVADO" && o.status !== "CANCELADO",
          )
          .reduce((acc, o) => acc + Number(o.total), 0)
      : 0;

  const {
    data: products = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const res = await api.get("/products");
      return res.data?.data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: topProducts = [] } = useQuery({
    queryKey: ["top-products"],
    queryFn: async () => {
      const res = await api.get("/products/top?limit=6");
      return res.data?.data ?? [];
    },
    staleTime: 10 * 60 * 1000,
  });

  const tCategory = (cat) => {
    const key = `CAT_${(cat ?? "GERAL")
      .toUpperCase()
      .replace(/\s+/g, "_")
      .replace(/[^A-Z0-9_]/g, "")}`;
    return t(key, cat ?? "Geral");
  };

  const rawCategories = Array.from(
    new Set(products.map((p) => p.category ?? "Geral").filter(Boolean)),
  ).sort((a, b) => {
    const ai = CATEGORY_ORDER.findIndex((k) => a.toLowerCase().includes(k));
    const bi = CATEGORY_ORDER.findIndex((k) => b.toLowerCase().includes(k));
    if (ai === -1 && bi === -1) return a.localeCompare(b, "pt-BR");
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  const ALL_LABEL = t("CARDAPIO_CAT_ALL", "Todos");

  function getJudimarCategoryLabel(category) {
    const raw = String(category ?? "").toLowerCase();

    if (raw.includes("espet")) {
      return t("CAT_JUDIMAR_ESPETINHOS", "Espetinhos");
    }

    if (raw.includes("por") || raw.includes("chapa")) {
      return t("CAT_JUDIMAR_PORCOES", "Porções");
    }

    if (
      raw.includes("refei") ||
      raw.includes("prato") ||
      raw.includes("comercial") ||
      raw.includes("executivo")
    ) {
      return t("CAT_JUDIMAR_REFEICOES", "Refeições (Pratos Feitos)");
    }

    if (
      raw.includes("bebida") ||
      raw.includes("suco") ||
      raw.includes("refrigerante") ||
      raw.includes("cerveja")
    ) {
      return t("CAT_JUDIMAR_BEBIDAS", "Bebidas");
    }

    if (
      raw.includes("dose") ||
      raw.includes("drink") ||
      raw.includes("destilado")
    ) {
      return t("CAT_JUDIMAR_DOSES", "Doses");
    }

    if (
      raw.includes("lanche") ||
      raw.includes("combo") ||
      raw.includes("hamb")
    ) {
      return t("CAT_JUDIMAR_LANCHES", "Lanches");
    }

    return tCategory(category);
  }

  const categoryGroups = rawCategories.reduce((acc, rawCategory) => {
    const label = getJudimarCategoryLabel(rawCategory);
    if (!acc[label]) {
      acc[label] = [];
    }
    acc[label].push(rawCategory);
    return acc;
  }, {});

  const categories = [ALL_LABEL, ...Object.keys(categoryGroups)];
  const normalizedSearch = search.trim().toLowerCase();

  const filtered =
    activeCategory === ALL_LABEL || activeCategory === "Todos"
      ? products
      : products.filter((p) =>
          (categoryGroups[activeCategory] ?? [activeCategory]).includes(
            p.category ?? "Geral",
          ),
        );

  const searched = normalizedSearch
    ? filtered.filter((product) =>
        [product.name, product.description, product.category]
          .filter(Boolean)
          .some((v) => v.toLowerCase().includes(normalizedSearch)),
      )
    : filtered;

  const topIds = new Set(topProducts.map((p) => p.id));

  return (
    <main className="min-h-screen bg-accent font-body text-text-main">
      <Navbar activeLink="cardapio" />

      {/* Header */}
      <div className="border-b border-border-soft bg-primary py-7 text-center">
        <p className="font-body text-[0.65rem] uppercase tracking-[0.35em] text-secondary">
          {t("CARDAPIO_SINCE", "Bar & Restaurante · Desde 1983")}
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold text-white sm:text-4xl">
          {t("CARDAPIO_TITLE", "Nosso Cardápio")}
        </h1>
      </div>

      {/* Category tabs */}
      <div className="sticky top-[61px] z-20 overflow-x-auto border-b border-border-soft bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl px-4 sm:px-8">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={`shrink-0 border-b-2 px-4 py-3 text-sm font-semibold transition-colors sm:px-5 ${
                activeCategory === cat
                  ? "border-secondary text-secondary"
                  : "border-transparent text-text-muted hover:text-primary"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <section className="mx-auto max-w-7xl px-4 pt-5 sm:px-8">
        <div className="flex items-center gap-3 rounded-lg border border-border-soft bg-white px-4 py-2.5 shadow-card">
          <svg
            className="h-4 w-4 text-text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("CARDAPIO_SEARCH_PH", "Buscar no cardápio...")}
            className="flex-1 bg-transparent text-sm text-text-main outline-none placeholder:text-text-muted/60"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="text-text-muted hover:text-primary text-lg leading-none"
            >
              &times;
            </button>
          )}
        </div>
      </section>

      {/* Products */}
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-8">
        {/* Destaques */}
        {!isLoading &&
          !isError &&
          topProducts.length > 0 &&
          normalizedSearch === "" &&
          activeCategory === ALL_LABEL && (
            <div className="mb-8">
              <div className="mb-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-border-soft" />
                <div className="text-center">
                  <p className="font-body text-[0.65rem] uppercase tracking-[0.3em] text-secondary">
                    {t("CARDAPIO_TOP_LABEL", "Favoritos da casa")}
                  </p>
                  <h2 className="font-display text-xl font-bold text-primary">
                    {t("CARDAPIO_TOP_TITLE", "Mais Pedidos")}
                  </h2>
                </div>
                <div className="h-px flex-1 bg-border-soft" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {topProducts.map((product) => (
                  <MenuCard
                    key={`top-${product.id}`}
                    product={product}
                    featured
                  />
                ))}
              </div>
              <div className="my-8 flex items-center gap-4">
                <div className="h-px flex-1 bg-border-soft" />
                <span className="font-display text-xs uppercase tracking-[0.25em] text-text-muted">
                  {t("CARDAPIO_ALL_SECTION", "Cardápio Completo")}
                </span>
                <div className="h-px flex-1 bg-border-soft" />
              </div>
            </div>
          )}

        {isLoading && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(9)].map((_, i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-lg bg-white/70 border border-border-soft"
              />
            ))}
          </div>
        )}

        {isError && (
          <p className="py-16 text-center text-text-muted">
            {t(
              "CARDAPIO_ERROR",
              "Não foi possível carregar o cardápio. Tente novamente.",
            )}
          </p>
        )}

        {!isLoading && !isError && searched.length === 0 && (
          <p className="py-16 text-center text-text-muted">
            {normalizedSearch
              ? t("CARDAPIO_EMPTY_SEARCH", "Nenhum item encontrado.")
              : t("CARDAPIO_EMPTY_CAT", "Nenhum item nesta categoria.")}
          </p>
        )}

        {!isLoading && !isError && searched.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {searched.map((product) => (
              <MenuCard
                key={product.id}
                product={product}
                featured={topIds.has(product.id)}
              />
            ))}
          </div>
        )}
      </section>

      <footer className="border-t border-border-soft py-6 text-center text-xs text-text-muted">
        {t(
          "FOOTER_COPYRIGHT",
          "Judimar Bar & Restaurante © 1983 · Sabor que marca presença!",
        )}
      </footer>

      {pendingTotal > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 p-3">
          <Link
            to="/mesa/checkout"
            className="flex items-center justify-between gap-3 rounded-lg bg-secondary px-5 py-4 shadow-2xl text-white font-semibold"
          >
            <span className="flex items-center gap-2 text-sm">
              &#128179; {t("CARDAPIO_PAYMENT_PENDING", "Pagamento pendente")}
            </span>
            <span className="text-base font-bold">
              {Number(pendingTotal).toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </span>
          </Link>
        </div>
      )}

      <CartDrawer />
      <ChamarGarcomButton />
    </main>
  );
}

export default CardapioPage;
