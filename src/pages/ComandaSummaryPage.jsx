import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api.js";

const currency = (value) =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

export default function ComandaSummaryPage() {
  const { token } = useParams();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["comanda-summary", token],
    queryFn: async () =>
      (await api.get(`/comandas/token/${token}/summary`)).data?.data,
    enabled: Boolean(token),
    refetchInterval: 20_000,
  });

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-6 text-gray-900 sm:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-gold">
            Consulta de Comanda
          </h1>
          <p className="mt-1 text-sm text-smoke">
            Resumo para fechamento da comanda.
          </p>
        </div>
        <Link
          to="/comandas"
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-600"
        >
          Voltar
        </Link>
      </div>

      {isLoading ? (
        <div className="rounded-3xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
          Carregando comanda...
        </div>
      ) : isError || !data ? (
        <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-center text-sm font-bold text-red-600">
          Nao foi possivel carregar essa comanda.
        </div>
      ) : (
        <section className="rounded-3xl border border-gold/30 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-smoke">
                Comanda
              </p>
              <h2 className="mt-1 font-display text-4xl text-primary">
                #{data.comanda.number}
              </h2>
              <p className="mt-1 text-lg font-bold text-gray-700">
                {data.comanda.name}
              </p>
            </div>
            <div className="rounded-3xl bg-red-50 px-5 py-4 text-right">
              <p className="text-sm font-bold uppercase text-red-500">
                Em aberto
              </p>
              <p className="mt-1 text-4xl font-black text-red-600">
                {currency(data.pendingTotal)}
              </p>
              <p className="mt-1 text-xs text-red-400">
                {data.pendingOrdersCount} pedido(s) pendente(s)
              </p>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
