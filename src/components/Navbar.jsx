import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useCart } from "../context/CartContext.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { api } from "../lib/api.js";
import { useTranslation } from "../context/I18nContext.jsx";

const WHATSAPP_NUMBER = "5511989742846";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}`;

// Ícone SVG oficial do WhatsApp
function WhatsAppIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
    </svg>
  );
}

/**
 * Navbar reutilizável para todas as páginas públicas.
 * Props:
 *   activeLink: "home" | "cardapio" | undefined
 */
export default function Navbar({ activeLink }) {
  const { openCart, items } = useCart();
  const { isAuthenticated, user, logout } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const longPressTimer = useRef(null);

  const LOGOUT_PIN = import.meta.env.VITE_MESA_LOGOUT_PIN || "2468";

  const handleLogoMouseDown = () => {
    if (user?.role !== "MESA") return;
    longPressTimer.current = setTimeout(() => {
      setShowPinModal(true);
      setPin("");
      setPinError(false);
    }, 3000);
  };

  const handleLogoMouseUp = () => {
    clearTimeout(longPressTimer.current);
  };

  const handlePinSubmit = () => {
    if (pin === LOGOUT_PIN) {
      setShowPinModal(false);
      logout();
      navigate("/");
    } else {
      setPinError(true);
      setPin("");
    }
  };

  const { data: mesaOrders = [] } = useQuery({
    queryKey: ["mesa-orders"],
    queryFn: async () => {
      const res = await api.get("/mesa/orders");
      return res.data?.data ?? [];
    },
    enabled: user?.role === "MESA",
    refetchInterval: 3 * 60 * 1000, // 3 minutos
  });

  const hasPendingPayment =
    user?.role === "MESA" &&
    mesaOrders.some(
      (o) => o.paymentStatus !== "APROVADO" && o.status !== "CANCELADO",
    );

  const painelTo =
    user?.role === "ATENDENTE"
      ? "/atendente"
      : user?.role === "ADMIN" || user?.role === "FUNCIONARIO"
        ? "/admin"
        : user?.role === "MOTOBOY"
          ? "/motoboy"
          : user?.role === "COZINHA"
            ? "/cozinha"
            : "/dashboard";

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-primary/20 bg-primary shadow-sm backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-8">
          {/* Logo — segure 3s para sair (só MESA) */}
          <Link
            to="/"
            onMouseDown={handleLogoMouseDown}
            onMouseUp={handleLogoMouseUp}
            onMouseLeave={handleLogoMouseUp}
            onTouchStart={handleLogoMouseDown}
            onTouchEnd={handleLogoMouseUp}
            draggable={false}
            className="flex items-center gap-2"
          >
            <img
              src="/logo-judimar.png"
              alt="Judimar Bar & Restaurante"
              className="h-20 w-auto object-contain"
            />
          </Link>

          {/* Links */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* WhatsApp */}
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-green-400/40 bg-green-900/30 px-3 py-2 text-sm font-semibold text-green-300 transition hover:bg-green-900/50"
              title={t("NAV_WHATSAPP_TITLE", "Falar no WhatsApp")}
            >
              <WhatsAppIcon />
              <span className="hidden sm:inline">WhatsApp</span>
            </a>

            <Link
              to="/cardapio"
              className={`text-sm font-semibold transition-colors hover:text-secondary ${
                activeLink === "cardapio"
                  ? "text-secondary underline underline-offset-4"
                  : "text-white/80"
              }`}
            >
              {t("NAV_CARDAPIO", "Cardápio")}
            </Link>

            {isAuthenticated && user?.role !== "MESA" ? (
              <>
                <Link
                  className="text-sm text-white/70 transition-colors hover:text-secondary"
                  to={painelTo}
                >
                  {t("NAV_PAINEL", "Painel")}
                </Link>
                <button
                  type="button"
                  onClick={logout}
                  className="text-sm text-white/60 transition-colors hover:text-secondary"
                >
                  {t("NAV_SAIR", "Sair")}
                </button>
              </>
            ) : !isAuthenticated ? (
              <Link
                className="text-sm text-white/80 transition-colors hover:text-secondary"
                to="/login"
              >
                {t("NAV_ENTRAR", "Entrar")}
              </Link>
            ) : null}

            {/* Pagamento pendente (só MESA) */}
            {hasPendingPayment && (
              <Link
                to="/mesa/checkout"
                className="flex items-center gap-1.5 rounded-lg border border-secondary/60 bg-secondary/20 px-3 py-2 text-sm font-semibold text-secondary transition hover:bg-secondary/30 animate-pulse"
              >
                💳 {t("NAV_PAGAR", "Pagar")}
              </Link>
            )}

            {/* Cart */}
            <button
              type="button"
              onClick={openCart}
              className="relative flex items-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-secondary/80"
            >
              <span>🛒</span>
              <span className="hidden sm:inline">
                {t("NAV_CARRINHO", "Carrinho")}
              </span>
              {items.length > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-black text-primary">
                  {items.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Modal de PIN para sair da sessão MESA */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xs rounded-3xl bg-white p-6 shadow-2xl text-center">
            <p className="text-3xl mb-2">🔒</p>
            <h2 className="font-bold text-gray-900 mb-1">
              {t("MODAL_END_SESSION", "Encerrar sessão")}
            </h2>
            <p className="text-xs text-gray-500 mb-4">
              {t("MODAL_PIN_DESC", "Digite o PIN de funcionário para sair")}
            </p>
            <input
              type="password"
              inputMode="numeric"
              maxLength={8}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setPinError(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && handlePinSubmit()}
              autoFocus
              className={`w-full rounded-xl border px-4 py-3 text-center text-lg tracking-widest outline-none mb-3 ${
                pinError ? "border-red-400 bg-red-50" : "border-gray-200"
              }`}
              placeholder="••••"
            />
            {pinError && (
              <p className="text-xs text-red-500 mb-2">
                {t("MODAL_PIN_WRONG", "PIN incorreto. Tente novamente.")}
              </p>
            )}
            <button
              onClick={handlePinSubmit}
              className="w-full rounded-xl bg-rosso py-3 text-sm font-semibold text-white hover:opacity-90 mb-2"
            >
              {t("BTN_CONFIRM", "Confirmar")}
            </button>
            <button
              onClick={() => setShowPinModal(false)}
              className="w-full rounded-xl border border-gray-200 py-2.5 text-sm text-gray-500 hover:border-gray-400"
            >
              {t("BTN_CANCEL", "Cancelar")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
