import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api.js";
import { useAuth } from "../hooks/useAuth.js";
import { useTranslation } from "../context/I18nContext.jsx";

function MesaAccessPage() {
  const { token } = useParams();
  const { login } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [status, setStatus] = useState(token ? "loading" : "error"); // loading | error

  useEffect(() => {
    // Se já está logado como MESA, vai direto para o cardápio da mesa
    if (!token) {
      return;
    }

    api
      .get(`/mesas/acesso/${token}`)
      .then((res) => {
        const { accessToken, mesa } = res.data.data;
        login({
          accessToken,
          user: {
            id: mesa.id,
            name: mesa.name,
            role: "MESA",
            mesaNumber: mesa.number,
          },
        });
        navigate("/cardapio-mesa", { replace: true });
      })
      .catch(() => setStatus("error"));
  }, [login, navigate, token]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-primary px-4">
        <img
          src="/logo-judimar.png"
          alt="Judimar"
          className="mb-2 h-16 w-auto object-contain opacity-90"
        />
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-transparent" />
        <p className="text-sm text-white/60 font-body">
          {t("MESA_ACCESS_LOADING", "Identificando mesa...")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-primary px-4 text-center">
      <img
        src="/logo-judimar.png"
        alt="Judimar"
        className="mb-2 h-16 w-auto object-contain opacity-80"
      />
      <div className="rounded-full border-2 border-secondary/30 bg-secondary/10 p-4 text-4xl">
        &#10060;
      </div>
      <h1 className="font-display text-xl font-bold text-white">
        {t("MESA_ACCESS_INVALID_QR_TITLE", "QR Code inválido")}
      </h1>
      <p className="max-w-xs text-sm leading-relaxed text-white/55 font-body">
        {t(
          "MESA_ACCESS_INVALID_QR_TEXT_1",
          "Este QR code expirou ou não é mais válido.",
        )}
        <br />
        {t(
          "MESA_ACCESS_INVALID_QR_TEXT_2",
          "Peça para um atendente gerar um novo.",
        )}
      </p>
      <p className="mt-2 font-display text-xs uppercase tracking-[0.25em] text-secondary">
        Judimar Bar &amp; Restaurante · Desde 1983
      </p>
    </div>
  );
}

export default MesaAccessPage;
