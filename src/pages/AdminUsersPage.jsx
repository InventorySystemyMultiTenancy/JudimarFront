import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { api } from "../lib/api.js";
import { useTranslation } from "../context/I18nContext.jsx";

const ROLES = [
  {
    value: "ATENDENTE",
    emoji: "🧾",
    key: "ADMIN_USERS_ROLE_ATENDENTE",
    fallback: "Atendente",
  },
  {
    value: "MOTOBOY",
    emoji: "🛵",
    key: "ADMIN_USERS_ROLE_MOTOBOY",
    fallback: "Motoboy",
  },
  {
    value: "COZINHA",
    emoji: "👨‍🍳",
    key: "ADMIN_USERS_ROLE_COZINHA",
    fallback: "Cozinha",
  },
  {
    value: "FUNCIONARIO",
    emoji: "🧑‍💼",
    key: "ADMIN_USERS_ROLE_FUNCIONARIO",
    fallback: "Funcionário",
  },
  {
    value: "ADMIN",
    emoji: "🔑",
    key: "ADMIN_USERS_ROLE_ADMIN",
    fallback: "Admin",
  },
  {
    value: "CLIENTE",
    emoji: "👤",
    key: "ADMIN_USERS_ROLE_CLIENTE",
    fallback: "Cliente",
  },
];

const EMPTY = {
  name: "",
  email: "",
  phone: "",
  password: "",
  role: "ATENDENTE",
};

function AdminUsersPage() {
  const { t } = useTranslation();
  const [form, setForm] = useState(EMPTY);
  const [showPassword, setShowPassword] = useState(false);
  const [created, setCreated] = useState(null);

  const roleLabel = (role) => {
    const match = ROLES.find((r) => r.value === role);
    if (!match) return t("ADMIN_USERS_GENERIC_USER", "Usuário");
    return `${match.emoji} ${t(match.key, match.fallback)}`;
  };

  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post("/auth/users", payload);
      return res.data?.data;
    },
    onSuccess: (user) => {
      setCreated(user);
      setForm(EMPTY);
      toast.success(
        t("ADMIN_USERS_CREATED_SUCCESS", "Usuário criado com sucesso!"),
      );
    },
    onError: (err) => {
      const errData = err?.response?.data?.error;
      const fieldErrors = errData?.details?.fieldErrors;
      if (fieldErrors) {
        const first = Object.entries(fieldErrors)[0];
        if (first) {
          const fieldNames = {
            name: t("ADMIN_USERS_FIELD_NAME", "Nome"),
            email: t("ADMIN_USERS_FIELD_EMAIL", "E-mail"),
            phone: t("ADMIN_USERS_FIELD_PHONE", "Telefone"),
            password: t("ADMIN_USERS_FIELD_PASSWORD", "Senha"),
            role: t("ADMIN_USERS_FIELD_ROLE", "Perfil"),
          };
          toast.error(`${fieldNames[first[0]] ?? first[0]}: ${first[1][0]}`);
          return;
        }
      }
      const msg =
        errData?.message ||
        t(
          "ADMIN_USERS_CREATE_ERROR",
          "Erro ao criar usuário. Verifique os dados.",
        );
      toast.error(msg);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      name: form.name.trim(),
      password: form.password,
      role: form.role,
    };
    if (form.email.trim()) payload.email = form.email.trim();
    if (form.phone.trim()) {
      const digitsOnly = form.phone.replace(/\D/g, "");
      if (digitsOnly.length < 10) {
        toast.error(
          t(
            "ADMIN_USERS_PHONE_MIN_DIGITS",
            "Telefone deve ter pelo menos 10 dígitos.",
          ),
        );
        return;
      }
      payload.phone = form.phone.trim();
    }
    if (!payload.email && !payload.phone) {
      toast.error(
        t(
          "ADMIN_USERS_EMAIL_OR_PHONE_REQUIRED",
          "Informe e-mail ou telefone para que o usuário possa fazer login.",
        ),
      );
      return;
    }
    createMutation.mutate(payload);
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-xl px-4 py-6 text-gray-900 sm:px-6">
      <div className="mb-6 flex items-center gap-4">
        <Link
          to="/admin"
          className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-500 transition hover:border-gray-400 hover:text-gray-800"
        >
          {t("ADMIN_USERS_BACK_PANEL", "← Painel Admin")}
        </Link>
        <h1 className="font-display text-3xl text-gold">
          {t("ADMIN_USERS_TITLE", "Criar Usuário")}
        </h1>
      </div>

      <div className="rounded-3xl border border-gold/20 bg-white p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Role selector */}
          <div>
            <label className="mb-2 block text-xs font-bold text-gray-500 uppercase tracking-wide">
              {t("ADMIN_USERS_ROLE_LABEL", "Perfil *")}
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {ROLES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({ ...prev, role: r.value }))
                  }
                  className={`rounded-2xl border py-3 text-sm font-semibold transition ${
                    form.role === r.value
                      ? "border-rosso bg-rosso text-white shadow"
                      : "border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-400"
                  }`}
                >
                  {`${r.emoji} ${t(r.key, r.fallback)}`}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">
              {t("ADMIN_USERS_NAME_LABEL", "Nome completo *")}
            </label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={120}
              placeholder={t("ADMIN_USERS_NAME_PLACEHOLDER", "Ex: João Silva")}
              value={form.name}
              onChange={set("name")}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-gold/60 focus:outline-none"
            />
          </div>

          {/* Email */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">
              {t("ADMIN_USERS_EMAIL_LABEL", "E-mail")}
            </label>
            <input
              type="email"
              placeholder={t("ADMIN_USERS_EMAIL_PLACEHOLDER", "ex@email.com")}
              value={form.email}
              onChange={set("email")}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-gold/60 focus:outline-none"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">
              {t("ADMIN_USERS_PHONE_LABEL", "Telefone")}
            </label>
            <input
              type="tel"
              placeholder={t(
                "ADMIN_USERS_PHONE_PLACEHOLDER",
                "(11) 99999-9999",
              )}
              value={form.phone}
              onChange={set("phone")}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-gold/60 focus:outline-none"
            />
            <p className="mt-1 text-xs text-gray-400">
              {t(
                "ADMIN_USERS_PHONE_HINT",
                "Pode ser usado para login no lugar do e-mail.",
              )}
            </p>
          </div>

          {/* Password */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">
              {t("ADMIN_USERS_PASSWORD_LABEL", "Senha *")}
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                placeholder={t(
                  "ADMIN_USERS_PASSWORD_PLACEHOLDER",
                  "Mínimo 6 caracteres",
                )}
                value={form.password}
                onChange={set("password")}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 pr-10 text-sm focus:border-gold/60 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={createMutation.isPending}
            className="w-full rounded-2xl bg-rosso py-3.5 text-sm font-bold text-white shadow transition hover:bg-ember disabled:opacity-50"
          >
            {createMutation.isPending
              ? t("ADMIN_USERS_CREATING", "Criando...")
              : `${t("ADMIN_USERS_CREATE_BUTTON", "Criar")} ${roleLabel(form.role)}`}
          </button>
        </form>
      </div>

      {/* Success card */}
      {created && (
        <div className="mt-5 rounded-3xl border border-green-200 bg-green-50 p-5">
          <p className="text-sm font-bold text-green-800">
            ✅ {t("ADMIN_USERS_CREATED_SUCCESS", "Usuário criado com sucesso!")}
          </p>
          <div className="mt-3 space-y-1 text-sm text-green-700">
            <p>
              <span className="font-semibold">
                {t("ADMIN_USERS_FIELD_NAME", "Nome")}:
              </span>{" "}
              {created.name}
            </p>
            {created.email && (
              <p>
                <span className="font-semibold">
                  {t("ADMIN_USERS_FIELD_EMAIL", "E-mail")}:
                </span>{" "}
                {created.email}
              </p>
            )}
            {created.phone && (
              <p>
                <span className="font-semibold">
                  {t("ADMIN_USERS_FIELD_PHONE", "Telefone")}:
                </span>{" "}
                {created.phone}
              </p>
            )}
            <p>
              <span className="font-semibold">
                {t("ADMIN_USERS_FIELD_ROLE", "Perfil")}:
              </span>{" "}
              {roleLabel(created.role)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreated(null)}
            className="mt-3 text-xs text-green-600 underline"
          >
            {t("ADMIN_USERS_CREATE_ANOTHER", "Criar outro usuário")}
          </button>
        </div>
      )}
    </main>
  );
}

export default AdminUsersPage;
