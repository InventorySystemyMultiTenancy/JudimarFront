import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { api } from "../lib/api.js";
import { useTranslation } from "../context/I18nContext.jsx";

const INPUT_CLS =
  "w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 text-sm outline-none transition focus:border-rosso focus:ring-2 focus:ring-rosso/10";

function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect") || null;
  const { login } = useAuth();
  const { t } = useTranslation();

  const [tab, setTab] = useState("login");
  const [loginForm, setLoginForm] = useState({ identifier: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    name: "",
    cpf: "",
    email: "",
    phone: "",
    password: "",
    address: "",
  });

  const handlePostAuth = (data) => {
    login(data);
    toast.success(tab === "login" ? "Login realizado!" : "Conta criada!");
    const role = data.user?.role;
    if (redirectTo) {
      navigate(redirectTo);
      return;
    }
    if (role === "COZINHA") {
      navigate("/cozinha");
      return;
    }
    if (role === "ATENDENTE") {
      navigate("/atendente");
      return;
    }
    if (["ADMIN", "FUNCIONARIO"].includes(role)) {
      navigate("/admin");
      return;
    }
    if (["CLIENTE", "MESA"].includes(role)) {
      navigate("/cardapio");
      return;
    }
    navigate("/");
  };

  const loginMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await api.post("/auth/login", payload);
      return response.data?.data;
    },
    onSuccess: handlePostAuth,
    onError: () => toast.error("Credenciais inválidas"),
  });

  const registerMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await api.post("/auth/register", payload);
      return response.data?.data;
    },
    onSuccess: handlePostAuth,
    onError: (err) => {
      const msg = err.response?.data?.message || "Erro ao criar conta";
      toast.error(msg);
    },
  });

  const onLoginSubmit = (e) => {
    e.preventDefault();
    loginMutation.mutate(loginForm);
  };

  const onRegisterSubmit = (e) => {
    e.preventDefault();
    const { name, cpf, email, phone, password, address } = registerForm;
    if (!email && !phone) {
      toast.error("Informe email ou telefone");
      return;
    }
    registerMutation.mutate({
      name,
      cpf: cpf || undefined,
      email: email || undefined,
      phone: phone || undefined,
      password,
      address: address || undefined,
    });
  };

  return (
    <main className="flex min-h-screen bg-white text-gray-900">
      {/* Left — hero */}
      <div className="relative hidden overflow-hidden lg:flex lg:w-1/2">
        <img
          src="https://images.unsplash.com/photo-1544025162-d76594e8bb4f?w=900&q=80"
          alt="Judimar Bar & Restaurante"
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-rosso/80 to-black/60" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-12 text-white">
          <div className="text-center">
            <img
              src="/logo-judimar.png"
              alt="Judimar Bar & Restaurante"
              className="mx-auto h-28 w-auto drop-shadow-xl"
            />
          </div>
          <p className="font-script text-2xl italic text-white/90">
            {t("LOGIN_TAGLINE_H", "Sabor que marca presença!")}
          </p>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex w-full items-center justify-center px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-sm">
          {/* Logo mobile */}
          <div className="mb-6 flex justify-center lg:hidden">
            <img
              src="/logo-judimar.png"
              alt="Judimar Bar & Restaurante"
              className="h-20 w-auto object-contain"
            />
          </div>

          {/* Tabs */}
          <div className="mb-6 flex rounded-2xl border border-gray-200 bg-gray-50 p-1">
            <button
              type="button"
              onClick={() => setTab("login")}
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${
                tab === "login"
                  ? "bg-white shadow text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t("LOGIN_ENTER", "Entrar")}
            </button>
            <button
              type="button"
              onClick={() => setTab("register")}
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition ${
                tab === "register"
                  ? "bg-white shadow text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t("LOGIN_CREATE_ACCOUNT", "Criar conta")}
            </button>
          </div>

          {tab === "login" ? (
            <>
              <h1 className="font-display text-2xl font-bold text-gray-900">
                {t("LOGIN_TITLE", "Bem-vindo")}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {t(
                  "LOGIN_SUBTITLE",
                  "Entre com email ou telefone para continuar.",
                )}
              </p>
              <form onSubmit={onLoginSubmit} className="mt-6 space-y-4">
                <input
                  type="text"
                  required
                  placeholder={t("LOGIN_PH_IDENTIFIER", "Email ou telefone")}
                  value={loginForm.identifier}
                  onChange={(e) =>
                    setLoginForm((p) => ({ ...p, identifier: e.target.value }))
                  }
                  className={INPUT_CLS}
                />
                <input
                  type="password"
                  required
                  placeholder={t("LOGIN_PH_PASSWORD", "Senha")}
                  value={loginForm.password}
                  onChange={(e) =>
                    setLoginForm((p) => ({ ...p, password: e.target.value }))
                  }
                  className={INPUT_CLS}
                />
                <button
                  type="submit"
                  disabled={loginMutation.isPending}
                  className="w-full rounded-2xl bg-rosso py-4 text-base font-bold text-white shadow-md transition hover:bg-ember disabled:opacity-50"
                >
                  {loginMutation.isPending
                    ? t("LOGIN_BTN_LOADING", "Entrando...")
                    : t("LOGIN_BTN", "Entrar")}
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="font-display text-2xl font-bold text-gray-900">
                {t("REG_TITLE", "Criar conta")}
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                {t("REG_SUBTITLE", "Preencha os dados para se cadastrar.")}
              </p>
              <form onSubmit={onRegisterSubmit} className="mt-6 space-y-4">
                <input
                  type="text"
                  required
                  placeholder={t("REG_PH_NAME", "Nome completo")}
                  value={registerForm.name}
                  onChange={(e) =>
                    setRegisterForm((p) => ({ ...p, name: e.target.value }))
                  }
                  className={INPUT_CLS}
                />
                <input
                  type="text"
                  required
                  placeholder="CPF (000.000.000-00)"
                  value={registerForm.cpf}
                  onChange={(e) =>
                    setRegisterForm((p) => ({ ...p, cpf: e.target.value }))
                  }
                  className={INPUT_CLS}
                />
                <div className="space-y-2">
                  <input
                    type="email"
                    placeholder={t(
                      "REG_PH_EMAIL",
                      "Email (opcional se informar telefone)",
                    )}
                    value={registerForm.email}
                    onChange={(e) =>
                      setRegisterForm((p) => ({ ...p, email: e.target.value }))
                    }
                    className={INPUT_CLS}
                  />
                  <input
                    type="tel"
                    placeholder={t(
                      "REG_PH_PHONE",
                      "Telefone (opcional se informar email)",
                    )}
                    value={registerForm.phone}
                    onChange={(e) =>
                      setRegisterForm((p) => ({ ...p, phone: e.target.value }))
                    }
                    className={INPUT_CLS}
                  />
                  <p className="text-xs text-smoke">
                    {t("REG_NOTE", "* Informe ao menos email ou telefone")}
                  </p>
                </div>
                <input
                  type="password"
                  required
                  placeholder={t(
                    "REG_PH_PASSWORD",
                    "Senha (mínimo 6 caracteres)",
                  )}
                  value={registerForm.password}
                  onChange={(e) =>
                    setRegisterForm((p) => ({ ...p, password: e.target.value }))
                  }
                  className={INPUT_CLS}
                />
                <input
                  type="text"
                  required
                  placeholder={t("REG_PH_ADDRESS", "Endereço de entrega")}
                  value={registerForm.address}
                  onChange={(e) =>
                    setRegisterForm((p) => ({ ...p, address: e.target.value }))
                  }
                  className={INPUT_CLS}
                />
                <button
                  type="submit"
                  disabled={registerMutation.isPending}
                  className="w-full rounded-2xl bg-rosso py-4 text-base font-bold text-white shadow-md transition hover:bg-ember disabled:opacity-50"
                >
                  {registerMutation.isPending
                    ? t("REG_BTN_LOADING", "Criando conta...")
                    : t("REG_BTN", "Criar conta")}
                </button>
              </form>
            </>
          )}

          <Link
            to="/"
            className="mt-6 block text-center text-sm text-gray-400 transition hover:text-rosso"
          >
            {t("LOGIN_BACK", "← Voltar para o cardápio")}
          </Link>
        </div>
      </div>
    </main>
  );
}

export default LoginPage;
