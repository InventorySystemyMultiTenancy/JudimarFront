import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { useTranslation } from "../context/I18nContext.jsx";

const EMPTY_FORM = { name: "", number: "", terminalId: "" };

// ── Modal de QR Code ─────────────────────────────────────────────────────────
function QrModal({ mesa, onClose }) {
  const { t } = useTranslation();
  const url = `${window.location.origin}/mesa/${mesa.accessToken}`;

  const handlePrint = () => {
    const win = window.open("", "_blank");
    win.document.write(`
      <html><head><title>QR Mesa ${mesa.number}</title>
      <style>
        body { font-family: sans-serif; text-align: center; padding: 40px; }
        h2 { margin-bottom: 8px; }
        p { color: #555; font-size: 14px; margin-bottom: 20px; }
        svg { display: block; margin: 0 auto; }
        small { display: block; margin-top: 16px; color: #888; word-break: break-all; font-size: 11px; }
      </style></head>
      <body onload="window.print()">
        <h2>${mesa.name}</h2>
        <p>Escaneie para fazer seu pedido</p>
        <img src="${document.getElementById("qr-svg-" + mesa.id)?.querySelector("svg") ? "data:image/svg+xml;base64," + btoa(new XMLSerializer().serializeToString(document.getElementById("qr-svg-" + mesa.id).querySelector("svg"))) : ""}" width="200" height="200"/>
        <small>${url}</small>
      </body></html>
    `);
    win.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-xs rounded-3xl bg-white p-6 shadow-2xl">
        <h2 className="mb-1 text-center font-display text-xl text-gray-900">
          {mesa.name}
        </h2>
        <p className="mb-4 text-center text-xs text-gray-500">
          {t(
            "ADMIN_MESAS_QR_SCAN_HINT",
            "Mesa {{number}} — escaneie para pedir",
          ).replace("{{number}}", mesa.number)}
        </p>

        <div id={`qr-svg-${mesa.id}`} className="flex justify-center">
          <QRCodeSVG value={url} size={200} includeMargin />
        </div>

        <p className="mt-3 break-all text-center text-[10px] text-gray-400">
          {url}
        </p>

        <div className="mt-5 flex gap-3">
          <button
            onClick={handlePrint}
            className="flex-1 rounded-xl bg-gold py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            {t("ADMIN_MESAS_PRINT", "🖨️ Imprimir")}
          </button>
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:border-gray-400"
          >
            {t("BTN_CLOSE", "Fechar")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Modal de criação / edição ─────────────────────────────────────────────────
function MesaModal({ mesa, onClose }) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const isEdit = !!mesa;

  const [form, setForm] = useState(
    isEdit
      ? {
          name: mesa.name,
          number: String(mesa.number),
          terminalId: mesa.terminalId ?? "",
        }
      : EMPTY_FORM,
  );

  const set = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const mutation = useMutation({
    mutationFn: async (payload) => {
      if (isEdit) {
        const res = await api.put(`/mesas/${mesa.id}`, payload);
        return res.data;
      }
      const res = await api.post("/mesas", payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-mesas"] });
      toast.success(
        isEdit
          ? t("ADMIN_MESAS_UPDATED", "Mesa atualizada!")
          : t("ADMIN_MESAS_CREATED", "Mesa criada!"),
      );
      onClose();
    },
    onError: (err) => {
      toast.error(
        err?.response?.data?.error?.message ??
          t("ADMIN_MESAS_ERROR_SAVE", "Erro ao salvar mesa."),
      );
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const num = parseInt(form.number, 10);
    if (!form.name.trim())
      return toast.error(
        t("ADMIN_MESAS_ERROR_NAME", "Informe o nome da mesa."),
      );
    if (!num || num < 1)
      return toast.error(
        t("ADMIN_MESAS_ERROR_NUMBER", "Número de mesa inválido."),
      );

    const payload = {
      name: form.name.trim(),
      number: num,
    };
    if (form.terminalId.trim()) payload.terminalId = form.terminalId.trim();
    else if (isEdit) payload.terminalId = null; // limpar maquininha se apagado

    mutation.mutate(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
        <h2 className="mb-4 font-display text-xl text-gray-900">
          {isEdit
            ? t("ADMIN_MESAS_FORM_TITLE_EDIT", "Editar Mesa")
            : t("ADMIN_MESAS_FORM_TITLE_NEW", "Nova Mesa")}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">
              {t("ADMIN_MESAS_FORM_NAME_LABEL", "Nome da mesa *")}
            </label>
            <input
              type="text"
              required
              maxLength={100}
              placeholder={t("ADMIN_MESAS_FORM_NAME_PH", "Ex: Mesa Varanda 1")}
              value={form.name}
              onChange={set("name")}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-gold/60 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">
              {t("ADMIN_MESAS_FORM_NUMBER_LABEL", "Número da mesa *")}
            </label>
            <input
              type="number"
              required
              min={1}
              max={999}
              placeholder="Ex: 1"
              value={form.number}
              onChange={set("number")}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-gold/60 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">
              {t(
                "ADMIN_MESAS_FORM_TERMINAL_LABEL",
                "ID da Maquininha (Mercado Pago Point)",
              )}
            </label>
            <input
              type="text"
              maxLength={100}
              placeholder="Ex: PAX_A867EC0ED627"
              value={form.terminalId}
              onChange={set("terminalId")}
              className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-mono focus:border-gold/60 focus:outline-none"
            />
            <p className="mt-1 text-[10px] text-gray-400">
              {t(
                "ADMIN_MESAS_FORM_TERMINAL_HINT",
                "Deixe em branco se a mesa não tiver maquininha dedicada.",
              )}
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 rounded-xl bg-rosso py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {mutation.isPending
                ? t("ADMIN_MESAS_SAVING", "Salvando...")
                : t("ADMIN_MESAS_SAVE", "Salvar")}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:border-gray-400"
            >
              {t("ADMIN_MESAS_CANCEL", "Cancelar")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Card de cada mesa ─────────────────────────────────────────────────────────
function MesaCard({ mesa, onEdit, onQr }) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/mesas/${mesa.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-mesas"] });
      toast.success(t("ADMIN_MESAS_REMOVED", "Mesa removida."));
    },
    onError: (err) => {
      toast.error(
        err?.response?.data?.error?.message ??
          t("ADMIN_MESAS_REMOVE_ERROR", "Erro ao remover mesa."),
      );
    },
  });

  const regenMutation = useMutation({
    mutationFn: () => api.post(`/mesas/${mesa.id}/regenerar-token`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-mesas"] });
      toast.success(t("ADMIN_MESAS_QR_GENERATED", "Novo QR code gerado!"));
    },
    onError: () =>
      toast.error(t("ADMIN_MESAS_QR_ERROR", "Erro ao regenerar QR code.")),
  });

  const handleDelete = () => {
    if (
      !window.confirm(
        t(
          "ADMIN_MESAS_CONFIRM_REMOVE",
          'Remover "{{name}}"? Esta ação não pode ser desfeita.',
        ).replace("{{name}}", mesa.name),
      )
    )
      return;
    deleteMutation.mutate();
  };

  const handleRegen = () => {
    if (
      !window.confirm(
        t(
          "ADMIN_MESAS_CONFIRM_REGEN",
          'Gerar novo QR code para "{{name}}"? O QR code antigo deixará de funcionar.',
        ).replace("{{name}}", mesa.name),
      )
    )
      return;
    regenMutation.mutate();
  };

  return (
    <div
      className={`rounded-2xl border p-4 transition ${
        mesa.isActive
          ? "border-gold/20 bg-white"
          : "border-gray-200 bg-gray-50 opacity-60"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900">
            {mesa.name}
            {!mesa.isActive && (
              <span className="ml-2 text-xs font-normal text-gray-400">
                {t("ADMIN_MESAS_INACTIVE", "(inativa)")}
              </span>
            )}
          </p>
          <p className="text-xs text-gray-500">
            {t("ADMIN_MESAS_TABLE_NUMBER", "Mesa nº {{number}}").replace(
              "{{number}}",
              mesa.number,
            )}
          </p>
          {mesa.terminalId ? (
            <p className="mt-0.5 font-mono text-[10px] text-gray-400">
              🖲️ {mesa.terminalId}
            </p>
          ) : (
            <p className="mt-0.5 text-[10px] text-amber-500">
              {t("ADMIN_MESAS_NO_TERMINAL", "⚠️ Sem maquininha vinculada")}
            </p>
          )}
        </div>

        <button
          onClick={() => onQr(mesa)}
          className="flex-shrink-0 rounded-xl bg-gold/10 px-3 py-2 text-xs font-semibold text-gold hover:bg-gold/20"
        >
          {t("ADMIN_MESAS_QR_BUTTON", "QR Code")}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={() => onEdit(mesa)}
          className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:border-gray-400"
        >
          {t("ADMIN_MESAS_EDIT_BUTTON", "✏️ Editar")}
        </button>
        <button
          onClick={handleRegen}
          disabled={regenMutation.isPending}
          className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:border-gray-400 disabled:opacity-50"
        >
          {t("ADMIN_MESAS_NEW_QR_BUTTON", "🔄 Novo QR")}
        </button>
        <button
          onClick={handleDelete}
          disabled={deleteMutation.isPending}
          className="rounded-xl border border-red-100 px-3 py-1.5 text-xs font-semibold text-red-400 hover:border-red-300 hover:text-red-600 disabled:opacity-50"
        >
          {t("ADMIN_MESAS_REMOVE_BUTTON", "🗑️ Remover")}
        </button>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
function AdminMesasPage() {
  const { t } = useTranslation();
  const [modal, setModal] = useState(null); // null | { type: "create"|"edit"|"qr", mesa? }

  const {
    data: mesas = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["admin-mesas"],
    queryFn: async () => {
      const res = await api.get("/mesas");
      return res.data?.data ?? [];
    },
  });

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-6 text-gray-900 sm:px-6">
      <div className="mb-6 flex items-center gap-4">
        <Link
          to="/admin"
          className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-500 transition hover:border-gray-400 hover:text-gray-800"
        >
          {t("ADMIN_MESAS_BACK_PANEL", "← Painel Admin")}
        </Link>
        <h1 className="font-display text-3xl text-gold">
          {t("ADMIN_MESAS_TITLE", "Mesas")}
        </h1>
      </div>

      {/* Como achar o ID da maquininha */}
      <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
        <p className="font-semibold">
          {t("ADMIN_MESAS_HELP_TITLE", "Como achar o ID da maquininha?")}
        </p>
        <p className="mt-1">
          {t("ADMIN_MESAS_HELP_TEXT_1", "No app do Mercado Pago")} →{" "}
          <strong>{t("ADMIN_MESAS_HELP_TEXT_2", "Seu negócio → Point")}</strong>{" "}
          →{" "}
          {t(
            "ADMIN_MESAS_HELP_TEXT_3",
            "selecione o dispositivo → copie o ID que aparece (ex:",
          )}{" "}
          <code className="font-mono">PAX_A867EC0ED627</code>).
        </p>
      </div>

      <button
        onClick={() => setModal({ type: "create" })}
        className="mb-5 w-full rounded-2xl bg-rosso py-3 text-sm font-semibold text-white hover:opacity-90"
      >
        + {t("ADMIN_MESAS_NEW_BUTTON", "Nova Mesa")}
      </button>

      {isLoading && (
        <p className="text-center text-sm text-gray-400">
          {t("ADMIN_MESAS_LOADING", "Carregando mesas...")}
        </p>
      )}
      {isError && (
        <p className="text-center text-sm text-red-400">
          {t("ADMIN_MESAS_LOAD_ERROR", "Falha ao carregar mesas.")}
        </p>
      )}

      {!isLoading && mesas.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
          {t("ADMIN_MESAS_EMPTY", "Nenhuma mesa cadastrada ainda.")}
          <br />
          {t("ADMIN_MESAS_EMPTY_HINT_1", "Clique em")}{" "}
          <strong>+ {t("ADMIN_MESAS_NEW_BUTTON", "Nova Mesa")}</strong>{" "}
          {t("ADMIN_MESAS_EMPTY_HINT_2", "para começar.")}
        </div>
      )}

      <div className="space-y-3">
        {mesas.map((mesa) => (
          <MesaCard
            key={mesa.id}
            mesa={mesa}
            onEdit={(m) => setModal({ type: "edit", mesa: m })}
            onQr={(m) => setModal({ type: "qr", mesa: m })}
          />
        ))}
      </div>

      {/* Modais */}
      {modal?.type === "create" && <MesaModal onClose={() => setModal(null)} />}
      {modal?.type === "edit" && (
        <MesaModal mesa={modal.mesa} onClose={() => setModal(null)} />
      )}
      {modal?.type === "qr" && (
        <QrModal mesa={modal.mesa} onClose={() => setModal(null)} />
      )}
    </main>
  );
}

export default AdminMesasPage;
