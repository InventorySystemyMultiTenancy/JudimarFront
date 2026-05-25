import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { useTranslation } from "../context/I18nContext.jsx";

function AdminMesaCardapioPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: "", number: "" });

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

  const createMesaMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await api.post("/mesas", payload);
      return res.data?.data;
    },
    onSuccess: () => {
      setForm({ name: "", number: "" });
      queryClient.invalidateQueries({ queryKey: ["admin-mesas"] });
      toast.success("Mesa cadastrada.");
    },
    onError: (err) => {
      toast.error(
        err?.response?.data?.error?.message || "Nao foi possivel cadastrar a mesa.",
      );
    },
  });

  const handleCreateMesa = (event) => {
    event.preventDefault();
    const number = Number(form.number);

    if (!form.name.trim()) {
      toast.error("Informe o nome da mesa.");
      return;
    }

    if (!Number.isInteger(number) || number < 1) {
      toast.error("Informe um numero de mesa valido.");
      return;
    }

    createMesaMutation.mutate({
      name: form.name.trim(),
      number,
    });
  };

  const handlePrint = (mesaId) => {
    const container = document.getElementById(`qr-print-${mesaId}`);
    const svg = container?.querySelector("svg");
    const html = `
      <html>
        <head>
          <title>QR Code Mesa</title>
          <style>
            body { margin: 0; padding: 24px; font-family: Inter, system-ui, sans-serif; }
            .page { display: grid; gap: 16px; justify-items: center; }
            .card { border-radius: 24px; border: 1px solid #e5e7eb; padding: 24px; text-align: center; }
            h1 { font-size: 20px; margin-bottom: 12px; }
            p { margin: 0; color: #374151; }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="card">
              <h1>${container?.dataset.name ?? "Mesa"}</h1>
              ${svg ? new XMLSerializer().serializeToString(svg) : ""}
              <p style="margin-top:16px; word-break: break-all;">${container?.dataset.url ?? ""}</p>
            </div>
          </div>
          <script>window.onload = () => window.print();</script>
        </body>
      </html>
    `;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html);
    win.document.close();
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link
          to="/admin"
          className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-500 transition hover:border-gray-400 hover:text-gray-800"
        >
          ↩️ Voltar ao Painel
        </Link>
        <div>
          <h1 className="font-display text-3xl font-bold text-gray-900">
            {t("ADMIN_MESAS_CARDAPIO_TITLE", "Cardápio da Mesa")}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {t(
              "ADMIN_MESAS_CARDAPIO_DESC",
              "Imprima o QR code para a mesa e permita que os clientes acessem o cardápio visual e chamem o atendente.",
            )}
          </p>
        </div>
      </div>

      <form
        onSubmit={handleCreateMesa}
        className="mb-5 grid gap-3 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:grid-cols-[1fr_160px_180px]"
      >
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-600">
            Nome da mesa *
          </label>
          <input
            type="text"
            maxLength={100}
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="Ex: Mesa 4"
            className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gold/60"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-600">
            Numero *
          </label>
          <input
            type="number"
            min={1}
            max={999}
            value={form.number}
            onChange={(event) =>
              setForm((current) => ({ ...current, number: event.target.value }))
            }
            placeholder="Ex: 4"
            className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none transition focus:border-gold/60"
          />
        </div>
        <button
          type="submit"
          disabled={createMesaMutation.isPending}
          className="self-end rounded-2xl bg-rosso px-4 py-3 text-sm font-bold text-white transition hover:bg-ember disabled:opacity-50"
        >
          {createMesaMutation.isPending ? "Cadastrando..." : "+ Cadastrar mesa"}
        </button>
      </form>

      <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-6 rounded-3xl border border-dashed border-gray-200 bg-slate-50 p-4 text-sm text-slate-700">
          {t(
            "ADMIN_MESAS_CARDAPIO_HINT",
            "Use este relatório para imprimir QR codes de mesa com o cardápio da mesa. Cada QR abre a versão somente visual, sem possibilidade de compra.",
          )}
        </div>

        {isLoading ? (
          <p className="text-sm text-gray-500">
            {t("LOADING", "Carregando...")}
          </p>
        ) : isError ? (
          <p className="text-sm text-red-500">
            {t("ADMIN_MESAS_CARDAPIO_ERROR", "Erro ao carregar mesas.")}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {mesas.map((mesa) => {
              const url = `${window.location.origin}/cardapio-mesa/${mesa.accessToken}`;
              return (
                <div
                  key={mesa.id}
                  className="rounded-3xl border border-gray-200 p-5 shadow-sm"
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">{mesa.name}</p>
                      <p className="text-sm text-gray-500">
                        {t(
                          "ADMIN_MESAS_TABLE_NUMBER",
                          "Mesa nº {{number}}",
                        ).replace("{{number}}", mesa.number)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePrint(mesa.id)}
                      className="rounded-full border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:border-gray-400"
                    >
                      {t("ADMIN_MESAS_PRINT_QR", "Imprimir")}
                    </button>
                  </div>

                  <div
                    id={`qr-print-${mesa.id}`}
                    data-name={mesa.name}
                    data-url={url}
                    className="mb-4 flex justify-center"
                  >
                    <QRCodeSVG value={url} size={180} includeMargin />
                  </div>

                  <p className="break-all text-xs text-gray-500">{url}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

export default AdminMesaCardapioPage;
