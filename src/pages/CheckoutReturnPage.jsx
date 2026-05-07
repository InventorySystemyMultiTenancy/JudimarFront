import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useCart } from "../context/CartContext.jsx";
import { api } from "../lib/api.js";
import { useTranslation } from "../context/I18nContext.jsx";

function CheckoutReturnPage() {
  const [searchParams] = useSearchParams();
  const { clearCart } = useCart();
  const { t } = useTranslation();

  const status = searchParams.get("status"); // approved | failure | pending | null
  const orderId = searchParams.get("external_reference");
  const paymentId = searchParams.get("payment_id");

  const isApproved = status === "approved";
  const isPending = status === "pending" || status === "in_process";

  const [confirmed, setConfirmed] = useState(isApproved);

  useEffect(() => {
    if (isApproved) {
      clearCart();

      // Confirma explicitamente no backend para cobrir casos onde o webhook
      // chegou com external_reference nulo (bug do Mercado Pago)
      if (orderId && paymentId) {
        api
          .post("/payments/checkout-confirm", { orderId, paymentId })
          .then(() => setConfirmed(true))
          .catch((err) =>
            console.warn(
              `[checkout-confirm] ${t("CHECKOUT_RETURN_CONFIRM_ERROR", "Erro ao confirmar")}:`,
              err,
            ),
          );
      }
    }
  }, [isApproved, clearCart, orderId, paymentId, t]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-ink px-4 text-gray-900">
      <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-xl">
        {isApproved ? (
          <>
            <div className="text-6xl">🎉</div>
            <h1 className="mt-4 font-display text-3xl text-gold">
              {t("CHECKOUT_RETURN_SUCCESS_TITLE", "Pagamento confirmado!")}
            </h1>
            <p className="mt-2 text-sm text-smoke">
              {t(
                "CHECKOUT_RETURN_SUCCESS_SUBTITLE",
                "Seu pedido foi recebido e já está sendo preparado com carinho.",
              )}
            </p>
            {orderId && (
              <p className="mt-3 rounded-xl bg-gray-50 px-4 py-2 font-mono text-xs text-smoke">
                {t("CHECKOUT_RETURN_ORDER_PREFIX", "Pedido")}: #
                {orderId.slice(-8).toUpperCase()}
              </p>
            )}
            <Link
              to="/dashboard"
              className="mt-6 block rounded-2xl bg-rosso py-4 font-bold text-white transition hover:bg-ember"
            >
              {t("CHECKOUT_RETURN_SUCCESS_BUTTON", "Acompanhar meu pedido")}
            </Link>
          </>
        ) : isPending ? (
          <>
            <div className="text-6xl">⏳</div>
            <h1 className="mt-4 font-display text-3xl text-gold">
              {t("CHECKOUT_RETURN_PENDING_TITLE", "Pagamento em análise")}
            </h1>
            <p className="mt-2 text-sm text-smoke">
              {t(
                "CHECKOUT_RETURN_PENDING_SUBTITLE",
                "Seu pagamento está sendo processado. Assim que confirmado, o preparo será iniciado.",
              )}
            </p>
            <Link
              to="/dashboard"
              className="mt-6 block rounded-2xl bg-rosso py-4 font-bold text-white transition hover:bg-ember"
            >
              {t("CHECKOUT_RETURN_PENDING_BUTTON", "Ver meus pedidos")}
            </Link>
          </>
        ) : (
          <>
            <div className="text-6xl">❌</div>
            <h1 className="mt-4 font-display text-3xl text-rosso">
              {t("CHECKOUT_RETURN_FAILURE_TITLE", "Pagamento não concluído")}
            </h1>
            <p className="mt-2 text-sm text-smoke">
              {t(
                "CHECKOUT_RETURN_FAILURE_SUBTITLE",
                "Houve um problema com o pagamento. Seu carrinho ainda está salvo.",
              )}
            </p>
            <Link
              to="/checkout"
              className="mt-6 block rounded-2xl bg-rosso py-4 font-bold text-white transition hover:bg-ember"
            >
              {t("CHECKOUT_RETURN_FAILURE_BUTTON", "Tentar novamente")}
            </Link>
            <Link
              to="/cardapio"
              className="mt-3 block text-sm text-gray-400 hover:text-rosso"
            >
              {t("CHECKOUT_RETURN_BACK_MENU", "Voltar ao cardápio")}
            </Link>
          </>
        )}
      </div>

      <img
        src="/logo-judimar.png"
        alt="Judimar Bar & Restaurante"
        className="mt-8 h-12 w-auto opacity-60"
      />
    </main>
  );
}

export default CheckoutReturnPage;
