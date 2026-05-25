import { createContext, useContext, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { AuthContext } from "./AuthContext.jsx";

const CartContext = createContext(null);

const FREIGHT_BASE = 0;

const currency = (value) =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const sumAddons = (addons = []) =>
  addons.reduce((sum, addon) => sum + Number(addon?.price || 0), 0);

function storageKey(userId) {
  return userId ? `pizzaria_cart_${userId}` : "pizzaria_cart_guest";
}

function scopedStorageKey(userId, scope) {
  const baseKey = storageKey(userId);
  return scope && scope !== "default" ? `${baseKey}_${scope}` : baseKey;
}

function loadCartFromStorage(userId, scope = "default") {
  try {
    const raw = localStorage.getItem(scopedStorageKey(userId, scope));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

const normalizeItem = (item) => {
  const id = String(item?.id || item?.productId || item?.key || "").trim();
  const nome = item?.nome || item?.name || item?.title || "Produto";
  const price = Number(item?.price ?? item?.basePrice ?? 0);
  const addons = Array.isArray(item?.addons) ? item.addons : [];
  const removals = Array.isArray(item?.removals) ? item.removals : [];
  const observation = item?.observation ?? item?.notes ?? "";
  const priceVariant = item?.priceVariant ?? item?.payload?.priceVariant ?? null;
  const priceVariantLabel =
    item?.priceVariantLabel ??
    (priceVariant === "COMERCIAL"
      ? "Comercial"
      : priceVariant === "PRATO_FEITO"
        ? "Prato feito"
        : "");
  const quantity = Math.max(1, Number(item?.quantity || 1));

  const fallbackKey = [
    id,
    priceVariant || "",
    addons
      .map((addon) => addon?.id || addon?.nome)
      .filter(Boolean)
      .sort()
      .join("."),
    removals.slice().sort().join("."),
    String(observation || "").trim(),
  ].join("|");

  return {
    ...item,
    id,
    nome,
    price,
    priceVariant,
    priceVariantLabel,
    addons,
    removals,
    observation,
    quantity,
    key: item?.key || fallbackKey,
  };
};

const itemUnitPrice = (item) =>
  Number(item?.price || 0) + sumAddons(item?.addons || []);

export function CartProvider({ children }) {
  const { user } = useContext(AuthContext);
  const userId = user?.id ?? null;

  const [cartScope, setCartScope] = useState("default");
  const [items, setItems] = useState(() => loadCartFromStorage(userId));
  const [isCartOpen, setIsCartOpen] = useState(false);

  useEffect(() => {
    setItems(loadCartFromStorage(userId, cartScope).map(normalizeItem));
  }, [userId, cartScope]);

  useEffect(() => {
    localStorage.setItem(
      scopedStorageKey(userId, cartScope),
      JSON.stringify(items),
    );
  }, [items, userId, cartScope]);

  const addItems = (itemsToAdd, { silent = false } = {}) => {
    setItems((prev) => {
      let next = [...prev];

      for (const rawItem of itemsToAdd) {
        const item = normalizeItem(rawItem);
        const existing = next.find((entry) => entry.key === item.key);

        if (existing) {
          next = next.map((entry) =>
            entry.key === item.key
              ? { ...entry, quantity: entry.quantity + (item.quantity || 1) }
              : entry,
          );
          continue;
        }

        next = [...next, item];
      }

      return next;
    });

    if (!silent) {
      toast.success(
        itemsToAdd.length > 1
          ? "Itens adicionados ao carrinho"
          : "Item adicionado ao carrinho",
      );
    }
  };

  const addItem = (item) => {
    addItems([item]);
  };

  const updateItem = (key, updater) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.key !== key) return item;
        const next =
          typeof updater === "function"
            ? updater(item)
            : { ...item, ...updater };
        return normalizeItem(next);
      }),
    );
  };

  const updateQuantity = (key, quantity) => {
    setItems((prev) =>
      prev
        .map((item) =>
          item.key === key ? normalizeItem({ ...item, quantity }) : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const removeItem = (key) => {
    setItems((prev) => prev.filter((item) => item.key !== key));
  };

  const clearCart = () => setItems([]);

  const subtotal = useMemo(
    () =>
      items.reduce((acc, item) => acc + itemUnitPrice(item) * item.quantity, 0),
    [items],
  );

  const freight = useMemo(() => {
    if (!subtotal) {
      return 0;
    }

    return 0;
  }, [subtotal]);

  const total = subtotal + freight;

  const value = useMemo(
    () => ({
      items,
      cartScope,
      setCartScope,
      isCartOpen,
      openCart: () => setIsCartOpen(true),
      closeCart: () => setIsCartOpen(false),
      addItem,
      addItems,
      updateItem,
      updateQuantity,
      removeItem,
      clearCart,
      subtotal,
      freight,
      total,
      formatted: {
        subtotal: currency(subtotal),
        freight: currency(freight),
        total: currency(total),
      },
    }),
    [items, cartScope, isCartOpen, subtotal, freight, total],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export const useCart = () => {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart deve ser usado dentro de CartProvider");
  }

  return context;
};
