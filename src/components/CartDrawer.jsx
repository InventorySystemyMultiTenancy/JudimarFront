import { useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { useTranslation } from "../context/I18nContext.jsx";
import CartProductCard from "./CartProductCard.jsx";

function CartDrawer() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { t } = useTranslation();
  const {
    items,
    isCartOpen,
    closeCart,
    updateItem,
    updateQuantity,
    removeItem,
    formatted,
    total,
  } = useCart();

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/70 transition-opacity duration-300 ${
          isCartOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
        onClick={closeCart}
      />

      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md transform flex-col bg-[#0f141b] p-4 text-[#e7ebf3] shadow-2xl transition-transform duration-300 ease-in-out sm:p-6 ${
          isCartOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-[#2a313d] pb-4">
          <h3 className="font-display text-2xl text-amber-400">
            {t("CART_TITLE", "Seu Carrinho")}
          </h3>
          <button
            type="button"
            onClick={closeCart}
            className="rounded-xl border border-[#2f3745] px-3 py-2 text-sm text-[#98a1b3] transition hover:bg-[#1a212c]"
          >
            ✕ {t("CART_CLOSE", "Fechar")}
          </button>
        </div>

        <div className="mt-5 flex-1 space-y-3 overflow-y-auto overscroll-contain pb-4 pr-1">
          {!items.length ? (
            <div className="rounded-2xl border border-dashed border-[#3c4555] p-6 text-center text-sm text-[#9ca5b8]">
              {t("CART_EMPTY", "Seu carrinho está vazio.")}
            </div>
          ) : (
            items.map((item) => (
              <CartProductCard
                key={item.key}
                item={item}
                onQuantityChange={(quantity) =>
                  updateQuantity(item.key, quantity)
                }
                onRemove={() => removeItem(item.key)}
                onObservationChange={(observation) =>
                  updateItem(item.key, { observation })
                }
              />
            ))
          )}
        </div>

        <footer className="mt-3 border-t border-[#2a313d] bg-[#0f141b] pt-4 sm:pt-6">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-[#9da5b7]">
              <span>{t("CART_SUBTOTAL", "Subtotal")}</span>
              <span>{formatted.subtotal}</span>
            </div>
            <div className="flex justify-between text-[#9da5b7]">
              <span>{t("CART_FREIGHT", "Frete")}</span>
              <span>{formatted.freight}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-amber-400">
              <span>{t("CART_TOTAL", "Total")}</span>
              <span>{formatted.total}</span>
            </div>
          </div>

          <button
            type="button"
            disabled={!total}
            onClick={() => {
              closeCart();
              if (user?.role === "MESA") {
                navigate("/mesa/checkout");
              } else if (!isAuthenticated) {
                navigate("/login?redirect=/checkout");
              } else {
                navigate("/checkout");
              }
            }}
            className={`mt-4 block w-full rounded-2xl px-5 py-4 text-center text-base font-bold transition ${
              total
                ? "bg-amber-400 text-[#10151d] shadow-md hover:bg-amber-300"
                : "cursor-not-allowed bg-[#232b36] text-[#667085]"
            }`}
          >
            {t("CART_BTN_CHECKOUT", "Finalizar Compra")}
          </button>
        </footer>
      </aside>
    </>
  );
}

export default CartDrawer;
