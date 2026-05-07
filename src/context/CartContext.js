import { createContext, useContext, useMemo, useState } from "react";
import toast from "react-hot-toast";

const CartContext = createContext(null);

const FREIGHT_BASE = 8;

const currency = (value) =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const sumAddons = (addons = []) =>
  addons.reduce((sum, addon) => sum + Number(addon?.price || 0), 0);

const normalizeItem = (item) => {
  const id = String(item?.id || item?.productId || item?.key || "").trim();
  const nome = item?.nome || item?.name || item?.title || "Produto";
  const price = Number(item?.price ?? item?.basePrice ?? 0);
  const addons = Array.isArray(item?.addons) ? item.addons : [];
  const removals = Array.isArray(item?.removals) ? item.removals : [];
  const observation = item?.observation ?? item?.notes ?? "";
  const quantity = Math.max(1, Number(item?.quantity || 1));

  const fallbackKey = [
    id,
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
  const [items, setItems] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const addItem = (rawItem) => {
    const item = normalizeItem(rawItem);

    setItems((prev) => {
      const existing = prev.find((entry) => entry.key === item.key);

      if (existing) {
        return prev.map((entry) =>
          entry.key === item.key
            ? { ...entry, quantity: entry.quantity + (item.quantity || 1) }
            : entry,
        );
      }

      return [...prev, item];
    });

    toast.success("Item adicionado ao carrinho");
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
    if (!subtotal) return 0;
    if (subtotal >= 90) return 0;
    return FREIGHT_BASE + Math.max(0, 12 - items.length * 2);
  }, [subtotal, items.length]);

  const total = subtotal + freight;

  const value = useMemo(
    () => ({
      items,
      isCartOpen,
      openCart: () => setIsCartOpen(true),
      closeCart: () => setIsCartOpen(false),
      addItem,
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
    [items, isCartOpen, subtotal, freight, total],
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
