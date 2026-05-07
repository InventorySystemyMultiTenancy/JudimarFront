import { useState } from "react";
import { api } from "../lib/api.js";
import { useAuth } from "../hooks/useAuth.js";
import { useTranslation } from "../context/I18nContext.jsx";

/**
 * Botão flutuante "Chamar Garçom" — aparece apenas para usuários MESA.
 * Emite um alerta via API/socket que notifica a equipe de atendimento.
 */
export default function ChamarGarcomButton() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [status, setStatus] = useState("idle"); // idle | loading | sent | error

  if (user?.role !== "MESA") return null;

  const handleChamar = async () => {
    if (status === "loading" || status === "sent") return;
    setStatus("loading");
    try {
      await api.post("/mesas/chamar-garcom", {
        mesaNumber: user?.mesaNumber,
        mesaId: user?.id,
      });
      setStatus("sent");
      // Volta ao idle após 6 segundos para permitir novo chamado
      setTimeout(() => setStatus("idle"), 6000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 4000);
    }
  };

  const labelMap = {
    idle: t("CHAMAR_GARCOM_BTN", "Chamar Garçom"),
    loading: t("CHAMAR_GARCOM_LOADING", "Enviando..."),
    sent: t("CHAMAR_GARCOM_SENT", "Garçom chamado!"),
    error: t("CHAMAR_GARCOM_ERROR", "Erro. Tente novamente"),
  };

  const styleMap = {
    idle: "bg-primary text-white hover:bg-secondary shadow-card-hover",
    loading: "bg-primary/70 text-white/80 cursor-wait shadow-card",
    sent: "bg-green-700 text-white shadow-card",
    error: "bg-red-700 text-white shadow-card",
  };

  return (
    <button
      type="button"
      onClick={handleChamar}
      aria-live="polite"
      className={`fixed bottom-20 right-4 z-40 flex items-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition-all duration-300 sm:bottom-6 sm:right-6 ${styleMap[status]}`}
    >
      {/* Ícone de sino */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5 shrink-0"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12 22a2 2 0 001.995-1.85L14 20h-4a2 2 0 001.85 1.995L12 22zm6-6v-5a6 6 0 10-12 0v5l-2 2v1h16v-1l-2-2z" />
      </svg>
      <span>{labelMap[status]}</span>
    </button>
  );
}
