import { useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { api } from "../lib/api.js";
import { askPaymentMethod } from "../lib/paymentMethodPrompt.js";

const currency = (value) =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

export default function ComandaSummaryPage() {
  const { token } = useParams();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["comanda-summary", token],
    queryFn: async () =>
      (await api.get(`/comandas/token/${token}/summary`)).data?.data,
    enabled: Boolean(token),
    refetchInterval: 20_000,
  });

  const markPaid = useMutation({
    mutationFn: async ({ orderId, paymentMethod }) =>
      api.patch(`/orders/${orderId}/mark-paid`, { paymentMethod }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comanda-summary", token] });
      queryClient.invalidateQueries({ queryKey: ["caixa-pending-payments"] });
      queryClient.invalidateQueries({ queryKey: ["comandas-open-totals"] });
      toast.success("Pagamento baixado.");
    },
    onError: (error) =>
      toast.error(
        error?.response?.data?.error?.message ?? "Erro ao baixar pagamento.",
      ),
  });

  const markAllPaid = useMutation({
    mutationFn: async ({ orderIds, paymentMethod }) =>
      Promise.all(
        orderIds.map((orderId) =>
          api.patch(`/orders/${orderId}/mark-paid`, { paymentMethod }),
        ),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comanda-summary", token] });
      queryClient.invalidateQueries({ queryKey: ["caixa-pending-payments"] });
      queryClient.invalidateQueries({ queryKey: ["comandas-open-totals"] });
      toast.success("Comanda baixada.");
    },
    onError: (error) =>
      toast.error(
        error?.response?.data?.error?.message ?? "Erro ao baixar comanda.",
      ),
  });

  const handleMarkPaid = async (order) => {
    const paymentMethod = await askPaymentMethod({
      title: "Dar baixa / pago",
      text: `Pedido ${order.id.slice(-6).toUpperCase()} - ${currency(order.total)}`,
    });
    if (paymentMethod) {
      markPaid.mutate({ orderId: order.id, paymentMethod });
    }
  };

  const handleMarkAllPaid = async () => {
    const pendingOrders =
      data?.orders?.filter((order) => order.paymentStatus !== "APROVADO") ?? [];
    if (!pendingOrders.length) return;

    const paymentMethod = await askPaymentMethod({
      title: "Fechar comanda",
      text: `Total em aberto: ${currency(data.pendingTotal)}`,
    });
    if (paymentMethod) {
      markAllPaid.mutate({
        orderIds: pendingOrders.map((order) => order.id),
        paymentMethod,
      });
    }
  };

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-6 text-gray-900 sm:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-gold">
            Consulta de Comanda
          </h1>
          <p className="mt-1 text-sm text-smoke">
            Resumo para fechamento e conferência do cliente.
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
          Não foi possível carregar essa comanda.
        </div>
      ) : (
        <div className="space-y-5">
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
            {data.pendingOrdersCount > 0 ? (
              <button
                type="button"
                onClick={handleMarkAllPaid}
                disabled={markAllPaid.isPending}
                className="mt-5 w-full rounded-2xl bg-green-600 px-4 py-4 text-lg font-black uppercase text-white disabled:opacity-50"
              >
                Dar baixa em tudo
              </button>
            ) : null}
          </section>

          <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="font-display text-2xl text-primary">
              Pedidos e itens
            </h2>
            {!data.orders?.length ? (
              <div className="mt-4 rounded-2xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
                Nenhum pedido lançado hoje.
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {data.orders.map((order) => (
                  <article
                    key={order.id}
                    className="rounded-2xl border border-gray-200 p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-primary">
                          Pedido #{order.id.slice(-6).toUpperCase()}
                        </p>
                        <p className="text-xs text-gray-500">
                          {new Date(order.createdAt).toLocaleString("pt-BR")}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-bold text-gray-600">
                          {order.status}
                        </span>
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-bold ${
                            order.paymentStatus === "APROVADO"
                              ? "bg-green-100 text-green-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {order.paymentStatus === "APROVADO"
                            ? "Pago"
                            : "Pendente"}
                        </span>
                      </div>
                    </div>
                    <ul className="mt-4 space-y-2 text-sm text-gray-700">
                      {(order.items ?? []).map((item) => (
                        <li
                          key={item.id}
                          className="flex justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2"
                        >
                          <span>
                            <strong>{item.quantity}x</strong>{" "}
                            {item.product?.name ?? "Item"}
                          </span>
                      <span className="font-bold">
                            {currency(item.totalPrice)}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {order.notes ? (
                      <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                        Obs: {order.notes}
                      </p>
                    ) : null}
                    <p className="mt-4 border-t border-gray-100 pt-3 text-right text-lg font-black text-primary">
                      Total {currency(order.total)}
                    </p>
                    {order.paymentStatus !== "APROVADO" ? (
                      <button
                        type="button"
                        onClick={() => handleMarkPaid(order)}
                        disabled={markPaid.isPending || markAllPaid.isPending}
                        className="mt-3 w-full rounded-xl bg-green-600 px-3 py-3 text-sm font-black uppercase text-white disabled:opacity-50"
                      >
                        Dar baixa neste pedido
                      </button>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
