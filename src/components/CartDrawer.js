import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext.js";

function CartDrawer() {
  const {
    items,
    isCartOpen,
    closeCart,
    updateQuantity,
    removeItem,
    formatted,
    total,
  } = useCart();

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/70 transition ${
          isCartOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
        onClick={closeCart}
      />

      <aside
        className={`fixed right-0 top-0 z-50 h-full w-full max-w-md transform bg-[#101016] p-4 shadow-2xl transition duration-300 sm:p-6 ${
          isCartOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-2xl text-gold">Seu Carrinho</h3>
          <button
            type="button"
            onClick={closeCart}
            className="rounded-xl border border-white/10 px-3 py-2 text-sm text-smoke"
          >
            Fechar
          </button>
        </div>

        <div className="mt-5 space-y-3 overflow-y-auto pb-44">
          {!items.length ? (
            <div className="rounded-2xl border border-dashed border-white/20 p-6 text-center text-sm text-smoke">
              Seu carrinho esta vazio.
            </div>
          ) : (
            items.map((item) => (
              <article
                key={item.key}
                className="rounded-2xl border border-white/10 bg-black/30 p-3"
              >
                <h4 className="font-semibold text-white">{item.title}</h4>
                <p className="mt-1 text-xs text-smoke">{item.description}</p>

                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="h-9 w-9 rounded-xl border border-white/10 text-lg"
                      onClick={() =>
                        updateQuantity(item.key, item.quantity - 1)
                      }
                    >
                      -
                    </button>
                    <span className="w-7 text-center text-sm">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      className="h-9 w-9 rounded-xl border border-white/10 text-lg"
                      onClick={() =>
                        updateQuantity(item.key, item.quantity + 1)
                      }
                    >
                      +
                    </button>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-bold text-gold">
                      {(item.price * item.quantity).toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </p>
                    <button
                      type="button"
                      onClick={() => removeItem(item.key)}
                      className="text-xs text-red-400"
                    >
                      remover
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        <footer className="absolute bottom-0 left-0 right-0 border-t border-white/10 bg-[#101016] p-4 sm:p-6">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-smoke">
              <span>Subtotal</span>
              <span>{formatted.subtotal}</span>
            </div>
            <div className="flex justify-between text-smoke">
              <span>Frete</span>
              <span>{formatted.freight}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-gold">
              <span>Total</span>
              <span>{formatted.total}</span>
            </div>
          </div>

          <Link
            to="/checkout"
            onClick={closeCart}
            className={`mt-4 block rounded-2xl px-5 py-4 text-center text-base font-bold transition ${
              total
                ? "bg-gradient-to-r from-gold to-amber-300 text-black"
                : "pointer-events-none bg-white/10 text-white/30"
            }`}
          >
            Ir para Checkout
          </Link>
        </footer>
      </aside>
    </>
  );
}

export default CartDrawer;
