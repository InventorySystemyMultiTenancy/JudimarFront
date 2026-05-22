import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import Swal from "sweetalert2";
import { api } from "../lib/api.js";
import { useTranslation } from "../context/I18nContext.jsx";

const emptyForm = () => ({
  name: "",
  description: "",
  imageUrl: "",
  category: "",
  availableDays: [],
  waiterOnly: false,
  singlePrice: "",
  singleCostPrice: "",
});

function getPrimarySize(product) {
  return product?.sizes?.[0] ?? null;
}

// ── Tradução automática de produtos ──────────────────────────────────────────
const WEEKDAY_OPTIONS = [
  { value: "MON", label: "Seg" },
  { value: "TUE", label: "Ter" },
  { value: "WED", label: "Qua" },
  { value: "THU", label: "Qui" },
  { value: "FRI", label: "Sex" },
  { value: "SAT", label: "Sab" },
  { value: "SUN", label: "Dom" },
];

function formatAvailableDays(days) {
  if (!Array.isArray(days) || days.length === 0) return "Todos os dias";
  const labelByValue = Object.fromEntries(
    WEEKDAY_OPTIONS.map((day) => [day.value, day.label]),
  );
  return days.map((day) => labelByValue[day] ?? day).join(", ");
}

function isDebugEnabled() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem("i18n_debug") === "1";
}

function debugLog(...args) {
  if (isDebugEnabled()) {
    console.log("[I18N_DEBUG][AdminProducts]", ...args);
  }
}

function normalizeCategoryKey(cat) {
  return `CAT_${(cat ?? "GERAL")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "")}`;
}

function tProductField(t, productId, field, fallback) {
  const id = String(productId ?? "");
  const lowerKey = `PRODUCT_${id}_${field}`;
  const upperKey = `PRODUCT_${id.toUpperCase()}_${field}`;
  const upperValue = t(upperKey, fallback);
  const resolved = t(lowerKey, upperValue);
  debugLog("tProductField", {
    productId: id,
    field,
    lowerKey,
    upperKey,
    resolved,
    fallback,
  });
  return resolved;
}

// ─────────────────────────────────────────────────────────────────────────────

function ProductModal({ product, onClose, existingCategories = [] }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const isEdit = !!product;

  const [form, setForm] = useState(() => {
    if (!isEdit) return emptyForm();
    const firstSize = getPrimarySize(product);
    return {
      name: product.name,
      description: product.description ?? "",
      imageUrl: product.imageUrl ?? "",
      category: product.category ?? "",
      availableDays: Array.isArray(product.availableDays)
        ? product.availableDays
        : [],
      waiterOnly: Boolean(product.waiterOnly),
      singlePrice: firstSize?.price != null ? String(firstSize.price) : "",
      singleCostPrice:
        firstSize?.costPrice != null ? String(firstSize.costPrice) : "",
    };
  });

  const [errors, setErrors] = useState({});

  const mutation = useMutation({
    mutationFn: async (payload) => {
      if (isEdit) {
        const res = await api.put(`/admin/products/${product.id}`, payload);
        return res.data;
      }
      const res = await api.post("/admin/products", payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast.success(
        isEdit
          ? t("ADMIN_PRODUCTS_UPDATED", "Produto atualizado!")
          : t("ADMIN_PRODUCTS_CREATED", "Produto criado!"),
      );
      onClose();
    },
    onError: (err) => {
      toast.error(
        err?.response?.data?.message ??
          t("ADMIN_PRODUCTS_SAVE_ERROR", "Erro ao salvar produto"),
      );
    },
  });

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = "Nome obrigatório";
    if (
      form.singlePrice === "" ||
      isNaN(Number(form.singlePrice)) ||
      Number(form.singlePrice) <= 0
    ) {
      errs.singlePrice = "Preço inválido";
    }
    if (
      form.singleCostPrice !== "" &&
      (isNaN(Number(form.singleCostPrice)) || Number(form.singleCostPrice) < 0)
    ) {
      errs.singleCostPrice = "Custo inválido";
    }
    if (form.imageUrl && !/^https?:\/\/.+/.test(form.imageUrl))
      errs.imageUrl = "URL inválida (deve começar com http)";
    setErrors(errs);
    return !Object.keys(errs).length;
  };

  const toggleAvailableDay = (day) => {
    setForm((prev) => ({
      ...prev,
      availableDays: prev.availableDays.includes(day)
        ? prev.availableDays.filter((value) => value !== day)
        : [...prev.availableDays, day],
    }));
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      imageUrl: form.imageUrl.trim() || undefined,
      category: form.category.trim() || undefined,
      availableDays: form.availableDays,
      waiterOnly: form.waiterOnly,
      sizes: [
        {
          size: "GRANDE",
          price: Number(form.singlePrice),
          ...(form.singleCostPrice !== ""
            ? { costPrice: Number(form.singleCostPrice) }
            : {}),
        },
      ],
    };
    mutation.mutate(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4">
      <div className="fixed inset-0 bg-black/70" onClick={onClose} />
      <div className="relative z-10 my-auto w-full max-w-lg rounded-3xl border border-gold/20 bg-white p-6 shadow-2xl">
        <h2 className="font-display text-2xl text-gold">
          {isEdit
            ? t("ADMIN_PRODUCTS_EDIT_TITLE", "Editar Produto")
            : t("ADMIN_PRODUCTS_NEW_TITLE", "Novo Produto")}
        </h2>

        <form onSubmit={onSubmit} className="mt-5 space-y-4">
          {/* Name */}
          <div>
            <label className="mb-1 block text-xs uppercase tracking-widest text-smoke">
              {t("ADMIN_PRODUCTS_NAME_LABEL", "Nome *")}
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full rounded-2xl border border-gray-200 bg-gray-100 px-4 py-3 text-sm text-gray-900 outline-none focus:border-gold/50"
              placeholder={t(
                "ADMIN_PRODUCTS_NAME_PLACEHOLDER",
                "Ex: Calabresa Imperial",
              )}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-400">{errors.name}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-xs uppercase tracking-widest text-smoke">
              {t("ADMIN_PRODUCTS_DESCRIPTION_LABEL", "Descrição")}
            </label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm((p) => ({ ...p, description: e.target.value }))
              }
              rows={2}
              className="w-full resize-none rounded-2xl border border-gray-200 bg-gray-100 px-4 py-3 text-sm text-gray-900 outline-none focus:border-gold/50"
              placeholder={t(
                "ADMIN_PRODUCTS_DESCRIPTION_PLACEHOLDER",
                "Breve descrição do sabor...",
              )}
            />
          </div>

          {/* Category */}
          <div>
            <label className="mb-1 block text-xs uppercase tracking-widest text-smoke">
              {t("ADMIN_PRODUCTS_CATEGORY_LABEL", "Categoria")}
            </label>
            <input
              list="category-options"
              value={form.category}
              onChange={(e) =>
                setForm((p) => ({ ...p, category: e.target.value }))
              }
              className="w-full rounded-2xl border border-gray-200 bg-gray-100 px-4 py-3 text-sm text-gray-900 outline-none focus:border-gold/50"
              placeholder={t(
                "ADMIN_PRODUCTS_CATEGORY_PLACEHOLDER",
                "Ex: Doce, Salgado, Bebidas...",
              )}
            />
            <datalist id="category-options">
              {existingCategories.map((cat) => (
                <option key={cat} value={cat} />
              ))}
            </datalist>
          </div>

          {/* Available days */}
          <div>
            <label className="mb-2 block text-xs uppercase tracking-widest text-smoke">
              Dias em que aparece no cardapio
            </label>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {WEEKDAY_OPTIONS.map((day) => {
                const checked = form.availableDays.includes(day.value);
                return (
                  <label
                    key={day.value}
                    className={`flex cursor-pointer items-center justify-center rounded-xl border px-2 py-2 text-xs font-semibold transition ${
                      checked
                        ? "border-gold bg-gold/15 text-gold"
                        : "border-gray-200 bg-gray-100 text-gray-700 hover:border-gold/40"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAvailableDay(day.value)}
                      className="sr-only"
                    />
                    {day.label}
                  </label>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-smoke">
              Se nao marcar nenhum dia, o produto aparece todos os dias.
            </p>
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-gray-200 bg-gray-100 px-4 py-3 text-sm text-gray-900">
            <input
              type="checkbox"
              checked={form.waiterOnly}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  waiterOnly: e.target.checked,
                }))
              }
              className="mt-1 h-4 w-4 rounded border-gray-300 text-gold focus:ring-gold/30"
            />
            <span>
              <span className="block text-xs font-semibold uppercase tracking-widest text-smoke">
                Somente garcom
              </span>
              <span className="mt-1 block text-xs text-smoke">
                Marque para bebidas e itens que nao precisam aparecer na
                cozinha.
              </span>
            </span>
          </label>

          {/* Image URL */}
          <div>
            <label className="mb-1 block text-xs uppercase tracking-widest text-smoke">
              {t("ADMIN_PRODUCTS_IMAGE_URL", "URL da Imagem")}
            </label>
            <input
              value={form.imageUrl}
              onChange={(e) =>
                setForm((p) => ({ ...p, imageUrl: e.target.value }))
              }
              className="w-full rounded-2xl border border-gray-200 bg-gray-100 px-4 py-3 text-sm text-gray-900 outline-none focus:border-gold/50"
              placeholder="https://..."
            />
            {errors.imageUrl && (
              <p className="mt-1 text-xs text-red-400">{errors.imageUrl}</p>
            )}
            {form.imageUrl && !errors.imageUrl && (
              <img
                src={form.imageUrl}
                alt="preview"
                className="mt-2 h-20 w-full rounded-2xl object-cover"
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
            )}
          </div>

          {/* Sale Price + Cost Price + Stock Minimum */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-widest text-smoke">
                {t("ADMIN_PRODUCTS_SALE_PRICE", "Preço de venda *")}
              </label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-smoke">R$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.singlePrice}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, singlePrice: e.target.value }))
                  }
                  className="w-full rounded-xl border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gold/50"
                  placeholder="0,00"
                />
              </div>
              {errors.singlePrice && (
                <p className="mt-0.5 text-xs text-red-400">
                  {errors.singlePrice}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase tracking-widest text-smoke">
                {t("ADMIN_PRODUCTS_COST_PRICE", "Preço de custo")}
              </label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-smoke">R$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.singleCostPrice}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, singleCostPrice: e.target.value }))
                  }
                  className="w-full rounded-xl border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-900 outline-none focus:border-gold/50"
                  placeholder="0,00"
                />
              </div>
              {errors.singleCostPrice && (
                <p className="mt-0.5 text-xs text-red-400">
                  {errors.singleCostPrice}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-2xl border border-gray-200 py-3 text-sm text-smoke transition hover:border-gray-400"
            >
              {t("BTN_CANCEL", "Cancelar")}
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-400 py-3 text-sm font-bold text-[#11161d] transition hover:opacity-90 disabled:opacity-50"
            >
              {mutation.isPending
                ? t("ADMIN_PRODUCTS_SAVING", "Salvando...")
                : isEdit
                  ? t("BTN_SAVE", "Salvar")
                  : t("ADMIN_PRODUCTS_CREATE", "Criar")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProductCard({ product, onEdit }) {
  const { t, locale } = useTranslation();
  const queryClient = useQueryClient();
  const primarySize = getPrimarySize(product);
  const productName = tProductField(t, product.id, "NAME", product.name);
  const productDescription = product.description
    ? tProductField(t, product.id, "DESC", product.description)
    : null;
  const translatedCategory = product.category
    ? t(normalizeCategoryKey(product.category), product.category)
    : null;

  useEffect(() => {
    debugLog("productCard:render", {
      locale,
      productId: product.id,
      originalName: product.name,
      translatedName: productName,
      translatedDescription: productDescription,
    });
  }, [locale, product.id, product.name, productName, productDescription]);

  const toggleActive = useMutation({
    mutationFn: async () => {
      if (product.isActive) {
        await api.delete(`/admin/products/${product.id}`);
      } else {
        await api.patch(`/admin/products/${product.id}/restore`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast.success(
        product.isActive
          ? t("ADMIN_PRODUCTS_DISABLED", "Produto desativado")
          : t("ADMIN_PRODUCTS_RESTORED", "Produto reativado"),
      );
    },
    onError: () =>
      toast.error(t("ADMIN_PRODUCTS_STATUS_ERROR", "Falha ao alterar status")),
  });

  /*
  const refreshTranslations = null;
  const REAPPLY_TRANSLATIONS = useMutation({
    mutationFn: async () => {
      const baseLocale = "pt-BR";
      console.log(
        "[MUTATION] Iniciando reapplyTranslations com baseLocale:",
        baseLocale,
      );

      const summary = await saveProductTranslations(
        product.id,
        product.name,
        product.description,
        product.category,
        baseLocale,
      );

      console.log("[MUTATION] Summary retornado:", summary);

      if (!summary.total || summary.succeeded === 0) {
        console.error("[MUTATION] Erro - summary.total é 0 ou falsy");
        throw new Error("Translation sync failed");
      }

      console.log("[MUTATION] Sucesso - total:", summary.total);
      return summary;
    },
    onSuccess: ({ succeeded, failed }) => {
      console.log(
        "[MUTATION SUCCESS] succeeded:",
        succeeded,
        "failed:",
        failed,
      );
      refreshTranslations?.();
      if (failed > 0) {
        toast.success(
          t(
            "ADMIN_PRODUCTS_REAPPLY_TRANSLATION_PARTIAL",
            "Traducoes reaplicadas parcialmente ({{ok}} OK, {{fail}} falharam).",
          )
            .replace("{{ok}}", String(succeeded))
            .replace("{{fail}}", String(failed)),
        );
        return;
      }
      toast.success(
        t(
          "ADMIN_PRODUCTS_REAPPLY_TRANSLATION_SUCCESS",
          "Traducoes reaplicadas com sucesso.",
        ),
      );
    },
    onError: (error) => {
      console.error("[MUTATION ERROR]", error);
      toast.error(
        t(
          "ADMIN_PRODUCTS_REAPPLY_TRANSLATION_ERROR",
          "Falha ao reaplicar traducoes.",
        ),
      );
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async () => {
      await api.delete(`/admin/products/${product.id}/permanent`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast.success(t("ADMIN_PRODUCTS_DELETE_SUCCESS", "Produto excluido."));
    },
    onError: (error) => {
      toast.error(
        error?.response?.data?.error?.message ||
          t("ADMIN_PRODUCTS_DELETE_ERROR", "Falha ao excluir produto."),
      );
    },
  });

  const confirmDeleteProduct = async () => {
    const result = await Swal.fire({
      title: t("ADMIN_PRODUCTS_DELETE_CONFIRM_TITLE", "Excluir produto?"),
      text: t(
        "ADMIN_PRODUCTS_DELETE_CONFIRM_TEXT",
        "Essa acao remove o produto definitivamente. Produtos com historico de pedido nao podem ser excluidos.",
      ),
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: t("ADMIN_PRODUCTS_DELETE_CONFIRM", "Sim, excluir"),
      cancelButtonText: t("CANCEL", "Cancelar"),
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
    });

    if (result.isConfirmed) {
      deleteProduct.mutate();
    }
  };

  */

  const deleteProduct = useMutation({
    mutationFn: async () => {
      await api.delete(`/admin/products/${product.id}/permanent`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast.success(t("ADMIN_PRODUCTS_DELETE_SUCCESS", "Produto excluido."));
    },
    onError: (error) => {
      toast.error(
        error?.response?.data?.error?.message ||
          t("ADMIN_PRODUCTS_DELETE_ERROR", "Falha ao excluir produto."),
      );
    },
  });

  const confirmDeleteProduct = async () => {
    const result = await Swal.fire({
      title: t("ADMIN_PRODUCTS_DELETE_CONFIRM_TITLE", "Excluir produto?"),
      text: t(
        "ADMIN_PRODUCTS_DELETE_CONFIRM_TEXT",
        "Essa acao remove o produto definitivamente. Produtos com historico de pedido nao podem ser excluidos.",
      ),
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: t("ADMIN_PRODUCTS_DELETE_CONFIRM", "Sim, excluir"),
      cancelButtonText: t("CANCEL", "Cancelar"),
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
    });

    if (result.isConfirmed) {
      deleteProduct.mutate();
    }
  };

  return (
    <article
      className={`rounded-2xl border p-4 transition-all duration-200 ${
        product.isActive
          ? "border-gray-200 bg-lacquer/70"
          : "border-gray-100 bg-gray-50 opacity-50"
      }`}
    >
      {product.imageUrl ? (
        <img
          src={product.imageUrl}
          alt={productName}
          className="mb-3 h-32 w-full rounded-xl object-cover"
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      ) : (
        <div className="mb-3 flex h-32 w-full items-center justify-center rounded-xl bg-gray-100 text-3xl">
          �
        </div>
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-gray-900">
            {productName}
          </h3>
          {productDescription && (
            <p className="mt-0.5 line-clamp-2 text-xs text-smoke">
              {productDescription}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-xl px-2 py-1 text-xs font-bold ${
            product.isActive
              ? "bg-green-500/20 text-green-400"
              : "bg-gray-200 text-smoke"
          }`}
        >
          {product.isActive
            ? t("ADMIN_PRODUCTS_ACTIVE", "Ativo")
            : t("ADMIN_PRODUCTS_INACTIVE", "Inativo")}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1">
        {primarySize?.price != null && (
          <span className="rounded-xl bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
            R$ {Number(primarySize.price).toFixed(2)}
          </span>
        )}
        {primarySize?.costPrice != null && (
          <span className="rounded-xl bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
            Custo R$ {Number(primarySize.costPrice).toFixed(2)}
          </span>
        )}
        {translatedCategory ? (
          <span className="rounded-xl bg-gray-200 px-2 py-0.5 text-xs text-smoke">
            {translatedCategory}
          </span>
        ) : null}
        <span className="rounded-xl bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">
          {formatAvailableDays(product.availableDays)}
        </span>
        {product.waiterOnly ? (
          <span className="rounded-xl bg-cyan-100 px-2 py-0.5 text-xs font-semibold text-cyan-700">
            Somente garcom
          </span>
        ) : null}
      </div>

      <div
        className={`mt-4 grid gap-2 ${
          product.isActive ? "grid-cols-2" : "grid-cols-3"
        }`}
      >
        <button
          type="button"
          onClick={() => onEdit(product)}
          className="rounded-2xl border border-gold/30 py-2 text-xs font-semibold text-gold transition hover:bg-gold/10"
        >
          {t("EDIT", "Editar")}
        </button>
        <button
          type="button"
          disabled={toggleActive.isPending}
          onClick={() => toggleActive.mutate()}
          className={`rounded-2xl border py-2 text-xs font-semibold transition ${
            product.isActive
              ? "border-red-500/30 text-red-400 hover:bg-red-500/10"
              : "border-green-500/30 text-green-400 hover:bg-green-500/10"
          } disabled:opacity-50`}
        >
          {product.isActive
            ? t("ADMIN_PRODUCTS_DISABLE", "Desativar")
            : t("ADMIN_PRODUCTS_RESTORE", "Ativar")}
        </button>
        {!product.isActive ? (
          <button
            type="button"
            disabled={deleteProduct.isPending}
            onClick={confirmDeleteProduct}
            className="rounded-2xl border border-red-500/40 py-2 text-xs font-semibold text-red-500 transition hover:bg-red-500/10 disabled:opacity-50"
          >
            {t("ADMIN_PRODUCTS_DELETE", "Excluir")}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function AdminProductsPage() {
  const { t } = useTranslation();
  const [modal, setModal] = useState(null); // null | "new" | product object

  const {
    data: products = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const res = await api.get("/admin/products");
      return res.data?.data ?? [];
    },
  });

  const existingCategories = [
    ...new Set(
      products.map((p) => p.category).filter((c) => c && c !== "Geral"),
    ),
  ];

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-4 py-6 text-gray-900 sm:px-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-gold">
            {t("ADMIN_PRODUCTS_TITLE", "Produtos")}
          </h1>
          <p className="mt-1 text-sm text-smoke">
            {t("ADMIN_PRODUCTS_SUBTITLE", "Gerencie o cardápio do Judimar")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/admin/produtos"
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm transition hover:border-gold/30"
          >
            ← Produtos
          </Link>
          <button
            type="button"
            onClick={() => setModal("new")}
            className="rounded-2xl bg-amber-400 px-4 py-2 text-sm font-bold text-[#11161d] transition hover:bg-amber-300"
          >
            + {t("ADMIN_PRODUCTS_NEW_BUTTON", "Novo Produto")}
          </button>
        </div>
      </header>

      {isLoading && (
        <div className="mt-6 grid animate-pulse gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 rounded-2xl bg-gray-50" />
          ))}
        </div>
      )}

      {isError && (
        <p className="mt-6 text-sm text-red-300">
          {t("ADMIN_PRODUCTS_LOAD_ERROR", "Falha ao carregar produtos.")}
        </p>
      )}

      {!isLoading && !isError && (
        <>
          <p className="mt-4 text-xs text-smoke">
            {t("ADMIN_PRODUCTS_ACTIVE_COUNT", "{{count}} ativos").replace(
              "{{count}}",
              String(products.filter((p) => p.isActive).length),
            )}
            {" · "}
            {t("ADMIN_PRODUCTS_INACTIVE_COUNT", "{{count}} inativos").replace(
              "{{count}}",
              String(products.filter((p) => !p.isActive).length),
            )}
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onEdit={(p) => setModal(p)}
              />
            ))}
            {products.length === 0 && (
              <div className="col-span-full rounded-2xl border border-dashed border-white/15 p-10 text-center text-sm text-smoke">
                {t("ADMIN_PRODUCTS_EMPTY", "Nenhum produto cadastrado ainda.")}
              </div>
            )}
          </div>
        </>
      )}

      {modal && (
        <ProductModal
          product={modal === "new" ? null : modal}
          onClose={() => setModal(null)}
          existingCategories={existingCategories}
        />
      )}
    </main>
  );
}

export default AdminProductsPage;
