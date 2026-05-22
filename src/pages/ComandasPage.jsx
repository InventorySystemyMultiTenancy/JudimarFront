import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { useAuth } from "../hooks/useAuth.js";
import { askPaymentMethod } from "../lib/paymentMethodPrompt.js";

const currency = (value) =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

function primaryPrice(product) {
  return Number(product?.sizes?.[0]?.price ?? product?.price ?? 0);
}

function ComandaQr({ comanda, onClose }) {
  const url = `${window.location.origin}/comandas/${comanda.accessToken}`;

  const handlePrint = () => {
    const qr = document
      .getElementById(`comanda-qr-${comanda.id}`)
      ?.querySelector("svg");
    const qrData = qr
      ? `data:image/svg+xml;base64,${btoa(new XMLSerializer().serializeToString(qr))}`
      : "";
    const win = window.open("", "_blank");
    win.document.write(`
      <html><head><title>Comanda ${comanda.number}</title>
      <style>
        body { font-family: sans-serif; text-align: center; padding: 40px; }
        h1 { margin: 0 0 8px; }
        p { color: #555; margin: 0 0 20px; }
        small { display: block; margin-top: 16px; color: #777; word-break: break-all; }
      </style></head>
      <body onload="window.print()">
        <h1>Comanda ${comanda.number}</h1>
        <p>${comanda.name}</p>
        <img src="${qrData}" width="220" height="220" />
        <small>${url}</small>
      </body></html>
    `);
    win.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-xs rounded-3xl bg-white p-6 shadow-2xl">
        <h2 className="text-center font-display text-2xl text-primary">
          Comanda {comanda.number}
        </h2>
        <p className="mt-1 text-center text-sm text-gray-500">{comanda.name}</p>
        <div id={`comanda-qr-${comanda.id}`} className="mt-5 flex justify-center">
          <QRCodeSVG value={url} size={210} includeMargin />
        </div>
        <p className="mt-3 break-all text-center text-[11px] text-gray-400">
          {url}
        </p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={handlePrint}
            className="rounded-xl bg-primary py-2.5 text-sm font-bold text-white"
          >
            Imprimir
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-200 py-2.5 text-sm font-bold text-gray-600"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ComandasPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState({ name: "", number: "" });
  const [cart, setCart] = useState([]);
  const [notes, setNotes] = useState("");
  const [qrComanda, setQrComanda] = useState(null);

  const { data: comandas = [] } = useQuery({
    queryKey: ["comandas"],
    queryFn: async () => (await api.get("/comandas")).data?.data ?? [],
  });

  const { data: totals = [] } = useQuery({
    queryKey: ["comandas-open-totals"],
    queryFn: async () => (await api.get("/comandas/open-totals")).data?.data ?? [],
    refetchInterval: 30_000,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["comandas-products"],
    queryFn: async () => (await api.get("/products")).data?.data ?? [],
  });

  const selectedComanda = useMemo(
    () => comandas.find((comanda) => comanda.id === selectedId) ?? null,
    [comandas, selectedId],
  );

  const { data: orders = [], isLoading: isLoadingOrders } = useQuery({
    queryKey: ["comanda-orders", selectedId],
    queryFn: async () =>
      (await api.get(`/comandas/${selectedId}/orders`)).data?.data ?? [],
    enabled: Boolean(selectedId),
    refetchInterval: 30_000,
  });

  const totalById = useMemo(
    () => new Map(totals.map((row) => [row.comandaId, row])),
    [totals],
  );

  const cartTotal = cart.reduce(
    (sum, item) => sum + primaryPrice(item.product) * item.quantity,
    0,
  );

  const createComanda = useMutation({
    mutationFn: async () =>
      api.post("/comandas", {
        name: form.name.trim(),
        number: Number(form.number),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comandas"] });
      setForm({ name: "", number: "" });
      toast.success("Comanda criada.");
    },
    onError: (err) =>
      toast.error(err?.response?.data?.error?.message ?? "Erro ao criar."),
  });

  const regenToken = useMutation({
    mutationFn: async (id) => api.post(`/comandas/${id}/regenerar-token`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comandas"] });
      toast.success("QR atualizado.");
    },
  });

  const createOrder = useMutation({
    mutationFn: async () =>
      api.post(`/comandas/${selectedId}/orders`, {
        notes: notes.trim() || undefined,
        items: cart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
      }),
    onSuccess: () => {
      setCart([]);
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ["comanda-orders", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["comandas-open-totals"] });
      toast.success("Pedido lançado na comanda.");
    },
    onError: (err) =>
      toast.error(err?.response?.data?.error?.message ?? "Erro ao lançar pedido."),
  });

  const markPaid = useMutation({
    mutationFn: async ({ orderId, paymentMethod }) =>
      api.patch(`/orders/${orderId}/mark-paid`, { paymentMethod }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comanda-orders", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["comandas-open-totals"] });
      toast.success("Pagamento baixado.");
    },
    onError: (err) =>
      toast.error(
        err?.response?.data?.error?.message ?? "Erro ao baixar pagamento.",
      ),
  });

  const handleMarkPaid = async (orderId) => {
    const paymentMethod = await askPaymentMethod({
      title: "Dar baixa / pago",
      text: "Escolha a forma de pagamento recebida.",
    });
    if (paymentMethod) markPaid.mutate({ orderId, paymentMethod });
  };

  const addProduct = (product) => {
    setCart((current) => {
      const existing = current.find((item) => item.product.id === product.id);
      if (existing) {
        return current.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [...current, { product, quantity: 1 }];
    });
  };

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-6 text-gray-900 sm:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-gold">Comandas</h1>
          <p className="mt-1 text-sm text-smoke">
            Crie comandas, lance pedidos e consulte o valor em aberto pelo QR.
          </p>
        </div>
        <Link
          to="/admin"
          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600"
        >
          Voltar
        </Link>
      </div>

      {isAdmin ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!form.name.trim() || !Number(form.number)) {
              toast.error("Informe nome e número da comanda.");
              return;
            }
            createComanda.mutate();
          }}
          className="mb-6 grid gap-3 rounded-3xl border border-gold/20 bg-white p-4 shadow-sm sm:grid-cols-[1fr_160px_160px]"
        >
          <input
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="Nome da comanda"
            className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gold"
          />
          <input
            type="number"
            min="1"
            value={form.number}
            onChange={(event) =>
              setForm((current) => ({ ...current, number: event.target.value }))
            }
            placeholder="Número"
            className="rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gold"
          />
          <button className="rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white">
            Criar
          </button>
        </form>
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <aside className="space-y-3">
          {comandas.map((comanda) => {
            const stats = totalById.get(comanda.id);
            const selected = comanda.id === selectedId;

            return (
              <article
                key={comanda.id}
                className={`rounded-3xl border bg-white p-4 shadow-sm ${
                  selected ? "border-gold" : "border-gray-200"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedId(comanda.id)}
                  className="w-full text-left"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-xl text-primary">
                        Comanda {comanda.number}
                      </p>
                      <p className="text-sm font-semibold text-gray-700">
                        {comanda.name}
                      </p>
                    </div>
                    <span className="rounded-full bg-gray-900 px-2 py-1 text-xs font-bold text-white">
                      {stats?.activeCount ?? 0} pedidos
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-gray-500">
                    Em aberto:{" "}
                    <strong>{currency(stats?.pendingTotal ?? 0)}</strong>
                  </p>
                </button>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setQrComanda(comanda)}
                    className="flex-1 rounded-xl border border-gold/30 px-3 py-2 text-xs font-bold text-gold"
                  >
                    QR Code
                  </button>
                  {isAdmin ? (
                    <button
                      type="button"
                      onClick={() => regenToken.mutate(comanda.id)}
                      className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-xs font-bold text-gray-600"
                    >
                      Novo QR
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </aside>

        <section className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="font-display text-2xl text-primary">Cardápio</h2>
            <p className="mt-1 text-sm text-gray-500">
              Selecione a comanda e toque nos itens para lançar pedido.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {products.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  disabled={!selectedId}
                  onClick={() => addProduct(product)}
                  className="flex items-center gap-3 rounded-2xl border border-gray-200 p-3 text-left transition hover:border-gold disabled:opacity-50"
                >
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-16 w-16 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-xl bg-gray-100" />
                  )}
                  <div>
                    <p className="font-bold text-primary">{product.name}</p>
                    <p className="text-sm font-semibold text-secondary">
                      {currency(primaryPrice(product))}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="font-display text-xl text-primary">
                Fechamento da comanda
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                {selectedComanda
                  ? `Comanda ${selectedComanda.number} - ${selectedComanda.name}`
                  : "Selecione uma comanda."}
              </p>

              {!cart.length ? (
                <div className="mt-5 rounded-2xl border border-dashed border-gray-300 p-5 text-center text-sm text-gray-500">
                  Nenhum item selecionado.
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  {cart.map((item) => (
                    <div
                      key={item.product.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 p-3"
                    >
                      <div>
                        <p className="font-bold text-primary">
                          {item.product.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {item.quantity} x {currency(primaryPrice(item.product))}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            setCart((current) =>
                              current
                                .map((row) =>
                                  row.product.id === item.product.id
                                    ? {
                                        ...row,
                                        quantity: Math.max(1, row.quantity - 1),
                                      }
                                    : row,
                                )
                                .filter((row) => row.quantity > 0),
                            )
                          }
                          className="h-8 w-8 rounded-full border border-gray-200 font-bold"
                        >
                          -
                        </button>
                        <span className="w-6 text-center font-bold">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setCart((current) =>
                              current.map((row) =>
                                row.product.id === item.product.id
                                  ? { ...row, quantity: row.quantity + 1 }
                                  : row,
                              ),
                            )
                          }
                          className="h-8 w-8 rounded-full border border-gray-200 font-bold"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Observações do pedido"
                className="mt-4 w-full resize-none rounded-2xl border border-gray-200 px-4 py-3 text-sm outline-none focus:border-gold"
                rows={3}
              />
              <div className="mt-4 rounded-2xl bg-accent p-4">
                <div className="flex items-center justify-between font-bold text-primary">
                  <span>Total</span>
                  <span>{currency(cartTotal)}</span>
                </div>
              </div>
              <button
                type="button"
                disabled={!selectedId || !cart.length || createOrder.isPending}
                onClick={() => createOrder.mutate()}
                className="mt-4 w-full rounded-2xl bg-primary px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                Lançar pedido na comanda
              </button>
            </section>

            <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="font-display text-xl text-primary">
                Histórico detalhado
              </h2>
              {isLoadingOrders ? (
                <p className="mt-4 text-sm text-gray-500">Carregando...</p>
              ) : !orders.length ? (
                <p className="mt-4 rounded-2xl border border-dashed border-gray-300 p-5 text-center text-sm text-gray-500">
                  Nenhum pedido nesta comanda hoje.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {orders.map((order) => (
                    <article
                      key={order.id}
                      className="rounded-2xl border border-gray-200 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-primary">
                            Pedido #{order.id.slice(-6).toUpperCase()}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(order.createdAt).toLocaleTimeString(
                              "pt-BR",
                              { hour: "2-digit", minute: "2-digit" },
                            )}
                          </p>
                        </div>
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">
                          {order.paymentStatus === "APROVADO"
                            ? "Pago"
                            : "Pendente"}
                        </span>
                      </div>
                      <ul className="mt-3 space-y-1 text-sm text-gray-600">
                        {(order.items ?? []).map((item) => (
                          <li
                            key={item.id}
                            className="flex justify-between gap-3"
                          >
                            <span>
                              {item.quantity}x {item.product?.name ?? "Item"}
                            </span>
                            <span>{currency(item.totalPrice)}</span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-3 border-t border-gray-100 pt-2 text-right font-bold text-primary">
                        {currency(order.total)}
                      </p>
                      {order.paymentStatus !== "APROVADO" ? (
                        <button
                          type="button"
                          onClick={() => handleMarkPaid(order.id)}
                          disabled={markPaid.isPending}
                          className="mt-3 w-full rounded-xl bg-green-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
                        >
                          Dar baixa / pago
                        </button>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </section>
      </section>

      {qrComanda ? (
        <ComandaQr comanda={qrComanda} onClose={() => setQrComanda(null)} />
      ) : null}
    </main>
  );
}
