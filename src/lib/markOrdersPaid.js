import { api } from "./api.js";

// Baixa varios pedidos numa unica transacao no servidor: ou todos ficam
// pagos, ou nenhum. entries: [{ orderId, itemIds? }].
export async function markOrdersPaid(entries, paymentMethod) {
  const orders = entries
    .filter((entry) => entry?.orderId)
    .map(({ orderId, itemIds }) => ({
      orderId,
      ...(itemIds?.length ? { itemIds } : {}),
    }));

  if (!orders.length) return null;

  try {
    return await api.post("/orders/mark-paid-batch", {
      paymentMethod,
      orders,
    });
  } catch (error) {
    // Backend antigo sem a rota em lote: cai no fluxo pedido a pedido.
    if (error?.response?.status !== 404) throw error;

    return Promise.all(
      orders.map(({ orderId, itemIds }) =>
        api.patch(`/orders/${orderId}/mark-paid`, {
          paymentMethod,
          ...(itemIds?.length ? { itemIds } : {}),
        }),
      ),
    );
  }
}
