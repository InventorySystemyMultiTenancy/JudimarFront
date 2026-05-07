import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import toast from "react-hot-toast";
import { QRCodeSVG } from "qrcode.react";
import { useCart } from "../context/CartContext.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { api } from "../lib/api.js";
import { useTranslation } from "../context/I18nContext.jsx";

const currency = (v) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const isValidEntityId = (value) => String(value || "").trim().length > 0;

const mapItemToApi = (item) => {
  const payload = item.payload || {};
  const productId = payload.productId || item.id;

  if (isValidEntityId(productId)) {
    return {
      productId,
      addonIds: (
        payload.addonIds || (item.addons || []).map((addon) => addon.id)
      ).filter(isValidEntityId),
      removedIngredients:
        payload.removedIngredients ||
        (item.removals || []).join(", ") ||
        undefined,
      quantity: item.quantity,
      notes: item.observation || item.notes || undefined,
    };
  }
};

// ── Tela de PIX ───────────────────────────────────────────────────────────────
function PixScreen({ orderId, total, onClose }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const pixMutation = useMutation({
    mutationFn: () => api.post("/mesa/payments/pix", { orderId }),
  });

  const { data: pixData, isPending } = (() => {
    if (!pixMutation.data && !pixMutation.isPending && !pixMutation.isError) {
      pixMutation.mutate();
    }
    return pixMutation;
  })();

  // Polling do status do pagamento
  const { data: polledOrder } = useQuery({
    queryKey: ["mesa-order-status", orderId],
    queryFn: async () => {
      const res = await api.get(`/orders/${orderId}`);
      return res.data?.data;
    },
    refetchInterval: 4000,
    enabled: !!orderId,
  });

  useEffect(() => {
    if (polledOrder?.paymentStatus === "APROVADO") {
      toast.success(
        t("MESA_CHECKOUT_PAYMENT_CONFIRMED", "Pagamento confirmado! 🍕"),
      );
      queryClient.invalidateQueries({ queryKey: ["mesa-orders"] });
      onClose();
    }
  }, [polledOrder, queryClient, onClose, t]);

  const pix = pixMutation.data?.data?.data;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-xs rounded-3xl bg-white p-6 shadow-2xl text-center">
        <h2 className="font-display text-xl text-gray-900 mb-1">
          {t("MESA_PIX_TITLE", "Pagar com PIX")}
        </h2>
        <p className="text-2xl font-bold text-rosso mb-4">{currency(total)}</p>

        {pixMutation.isPending || !pix ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gold border-t-transparent" />
            <p className="text-xs text-gray-400">
              {t("MESA_PIX_GENERATING", "Gerando QR Code...")}
            </p>
          </div>
        ) : pixMutation.isError ? (
          <p className="text-sm text-red-500 py-4">
            {t("MESA_PIX_ERROR", "Erro ao gerar PIX. Tente novamente.")}
          </p>
        ) : (
          <>
            <div className="flex justify-center mb-3">
              {pix.qrCodeBase64 ? (
                <img
                  src={`data:image/png;base64,${pix.qrCodeBase64}`}
                  alt={t("MESA_PIX_QR_ALT", "QR Code PIX")}
                  className="w-48 h-48"
                />
              ) : (
                <QRCodeSVG value={pix.qrCode ?? ""} size={192} includeMargin />
              )}
            </div>
            <p className="text-xs text-gray-400 mb-1">
              {t("MESA_PIX_COPY_HINT", "Ou copie o código:")}
            </p>
            <button
              onClick={() => {
                navigator.clipboard.writeText(pix.qrCode ?? "");
                toast.success(t("MESA_PIX_COPIED", "Código copiado!"));
              }}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-600 hover:border-gray-400 truncate"
            >
              📋 {t("MESA_PIX_COPY_BUTTON", "Copiar código PIX")}
            </button>
            <p className="mt-3 text-xs text-gray-400 animate-pulse">
              {t("MESA_PIX_WAITING", "Aguardando confirmação do pagamento...")}
            </p>
          </>
        )}

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:border-gray-400"
        >
          {t("BTN_CANCEL", "Cancelar")}
        </button>
      </div>
    </div>
  );
}

// ── Tela de maquininha ────────────────────────────────────────────────────────
function TerminalScreen({ orderId, total, onClose }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [approved, setApproved] = useState(false);

  const terminalMutation = useMutation({
    mutationFn: () => api.post("/mesa/payments/terminal", { orderId }),
    onSuccess: () =>
      toast.success(
        t("MESA_TERMINAL_SENT", "Cobrança enviada para a maquininha!"),
      ),
    onError: (err) =>
      toast.error(
        err?.response?.data?.error?.message ??
          t("MESA_TERMINAL_SEND_ERROR", "Erro ao enviar para maquininha."),
      ),
  });

  // Polling do status
  const { data: polledTerminalOrder } = useQuery({
    queryKey: ["mesa-order-status", orderId],
    queryFn: async () => {
      const res = await api.get(`/orders/${orderId}`);
      return res.data?.data;
    },
    refetchInterval: approved ? false : 4000,
    enabled: !!orderId && !approved,
  });

  useEffect(() => {
    if (polledTerminalOrder?.paymentStatus === "APROVADO" && !approved) {
      setApproved(true);
      toast.success(
        t("MESA_CHECKOUT_PAYMENT_CONFIRMED", "Pagamento confirmado! 🍕"),
      );
      queryClient.invalidateQueries({ queryKey: ["mesa-orders"] });
      onClose();
    }
  }, [polledTerminalOrder, approved, queryClient, onClose, t]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-xs rounded-3xl bg-white p-6 shadow-2xl text-center">
        <p className="text-5xl mb-3">🖲️</p>
        <h2 className="font-display text-xl text-gray-900 mb-1">
          {t("MESA_TERMINAL_TITLE", "Pagar na Maquininha")}
        </h2>
        <p className="text-2xl font-bold text-rosso mb-4">{currency(total)}</p>

        {!terminalMutation.isSuccess ? (
          <button
            onClick={() => terminalMutation.mutate()}
            disabled={terminalMutation.isPending}
            className="w-full rounded-xl bg-rosso py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {terminalMutation.isPending
              ? t("MESA_TERMINAL_SENDING", "Enviando...")
              : t("MESA_TERMINAL_SEND_BUTTON", "Enviar para maquininha")}
          </button>
        ) : (
          <p className="text-sm text-green-600 font-semibold animate-pulse py-2">
            {t(
              "MESA_TERMINAL_WAITING",
              "Aguardando pagamento na maquininha...",
            )}
          </p>
        )}

        <button
          onClick={onClose}
          className="mt-3 w-full rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:border-gray-400"
        >
          {t("BTN_CANCEL", "Cancelar")}
        </button>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
function MesaCheckoutPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { items, subtotal, clearCart } = useCart();
  const [notes, setNotes] = useState("");
  const [createdOrderId, setCreatedOrderId] = useState(null);
  const [createdOrderTotal, setCreatedOrderTotal] = useState(0);
  const [payScreen, setPayScreen] = useState(null); // null | "pix" | "terminal"

  const orderMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        notes: notes.trim() || undefined,
        items: items.map(mapItemToApi).filter(Boolean),
      };

      console.log("[MesaCheckoutPage] create mesa order payload", {
        itemsCount: payload.items.length,
        firstItem: payload.items[0] ?? null,
        payload,
      });

      const res = await api.post("/mesa/orders", payload);
      return res.data?.data;
    },
    onSuccess: (order) => {
      setCreatedOrderId(order.id);
      setCreatedOrderTotal(Number(order.total));
      clearCart();
      toast.success(
        t("MESA_CHECKOUT_ORDER_SENT", "Pedido enviado para a cozinha!"),
      );
    },
    onError: (err) => {
      const data = err?.response?.data;
      const details = data?.error?.details?.fieldErrors;
      const detailText = details ? JSON.stringify(details) : null;
      console.error("[MesaCheckoutPage] create order failed", {
        status: err?.response?.status,
        data,
      });
      toast.error(
        data?.error?.message
          ? `${data.error.message}${detailText ? `: ${detailText}` : ""}`
          : t("MESA_CHECKOUT_ORDER_ERROR", "Erro ao fazer pedido."),
      );
    },
  });

  // Pedidos já feitos hoje nesta mesa
  const { data: mesaOrders = [] } = useQuery({
    queryKey: ["mesa-orders"],
    queryFn: async () => {
      const res = await api.get("/mesa/orders");
      return res.data?.data ?? [];
    },
  });

  const pendingPayment = mesaOrders.find(
    (o) => o.paymentStatus !== "APROVADO" && o.status !== "CANCELADO",
  );

  const totalPendente = mesaOrders
    .filter((o) => o.paymentStatus !== "APROVADO" && o.status !== "CANCELADO")
    .reduce((acc, o) => acc + Number(o.total), 0);

  if (items.length === 0 && !createdOrderId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-4xl">🛒</p>
        <p className="text-gray-500 text-sm">
          {t("CHECKOUT_EMPTY", "Seu carrinho está vazio.")}
        </p>
        <a
          href="/cardapio"
          className="mt-2 rounded-xl bg-rosso px-6 py-2.5 text-sm font-semibold text-white hover:opacity-90"
        >
          {t("MESA_CHECKOUT_VIEW_MENU", "Ver cardápio")}
        </a>

        {mesaOrders.length > 0 && (
          <div className="mt-6 w-full max-w-sm">
            <p className="mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {t("MESA_CHECKOUT_SESSION_ORDERS", "Pedidos desta sessão")}
            </p>
            <div className="space-y-2">
              {mesaOrders.map((o) => (
                <div
                  key={o.id}
                  className="rounded-2xl border border-gray-100 bg-white p-3 text-left"
                >
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold">{currency(o.total)}</span>
                    <span
                      className={`text-xs font-semibold ${
                        o.paymentStatus === "APROVADO"
                          ? "text-green-600"
                          : "text-amber-500"
                      }`}
                    >
                      {o.paymentStatus === "APROVADO"
                        ? `✅ ${t("PAYMENT_STATUS_APROVADO", "Pago")}`
                        : `⏳ ${t("PAYMENT_STATUS_PENDENTE", "Pendente")}`}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {totalPendente > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-bold text-gray-900">
                  {t("MESA_CHECKOUT_PENDING_TOTAL", "Total pendente")}:{" "}
                  {currency(totalPendente)}
                </p>
                <button
                  onClick={() => setPayScreen("pix")}
                  className="w-full rounded-xl bg-blue-500 py-3 text-sm font-semibold text-white hover:opacity-90"
                >
                  {t("MESA_PIX_TITLE", "Pagar com PIX")}
                </button>
                <button
                  onClick={() => setPayScreen("terminal")}
                  className="w-full rounded-xl bg-rosso py-3 text-sm font-semibold text-white hover:opacity-90"
                >
                  {t("MESA_TERMINAL_TITLE", "Pagar na Maquininha")}
                </button>
              </div>
            )}
          </div>
        )}

        {payScreen === "pix" && pendingPayment && (
          <PixScreen
            orderId={pendingPayment.id}
            total={Number(pendingPayment.total)}
            onClose={() => setPayScreen(null)}
          />
        )}
        {payScreen === "terminal" && pendingPayment && (
          <TerminalScreen
            orderId={pendingPayment.id}
            total={Number(pendingPayment.total)}
            onClose={() => setPayScreen(null)}
          />
        )}
      </div>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-lg px-4 py-6 text-gray-900">
      <div className="mb-5 flex items-center gap-3">
        <a
          href="/cardapio"
          className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-500 hover:border-gray-400"
        >
          {t("MESA_CHECKOUT_BACK_MENU", "← Cardápio")}
        </a>
        <h1 className="font-display text-2xl text-gold">
          {user?.name} — {t("MESA_CHECKOUT_TABLE", "Mesa")} {user?.mesaNumber}
        </h1>
      </div>

      {/* Itens */}
      <div className="rounded-3xl border border-gold/20 bg-white p-4 space-y-3 mb-4">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-400">
          {t("MESA_CHECKOUT_YOUR_ORDER", "Seu pedido")}
        </p>
        {items.map((item) => (
          <div key={item.key} className="flex justify-between text-sm">
            <span>
              {item.quantity}× {item.title}
              <span className="ml-1 text-xs text-gray-400">
                ({item.description})
              </span>
            </span>
            <span className="font-semibold">
              {currency(item.price * item.quantity)}
            </span>
          </div>
        ))}
        <div className="border-t border-gray-100 pt-2 flex justify-between font-bold">
          <span>{t("CART_TOTAL", "Total")}</span>
          <span>
            {createdOrderId ? currency(createdOrderTotal) : currency(subtotal)}
          </span>
        </div>
      </div>

      {/* Observações */}
      <div className="mb-4">
        <label className="mb-1 block text-xs font-semibold text-gray-600">
          {t("MESA_CHECKOUT_NOTES_LABEL", "Observações (opcional)")}
        </label>
        <textarea
          rows={2}
          maxLength={500}
          placeholder={t(
            "MESA_CHECKOUT_NOTES_PLACEHOLDER",
            "Ex: sem cebola, massa fina...",
          )}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-gold/60 focus:outline-none resize-none"
        />
      </div>

      {/* Botão confirmar pedido */}
      {!createdOrderId && (
        <button
          onClick={() => orderMutation.mutate()}
          disabled={orderMutation.isPending || items.length === 0}
          className="w-full rounded-2xl bg-rosso py-4 text-base font-bold text-white hover:opacity-90 disabled:opacity-50 mb-3"
        >
          {orderMutation.isPending
            ? t("MESA_CHECKOUT_SENDING", "Enviando...")
            : `${t("MESA_CHECKOUT_CONFIRM_ORDER", "Confirmar pedido")} • ${currency(subtotal)}`}
        </button>
      )}

      {/* Após confirmar, oferecer pagamento */}
      {createdOrderId && (
        <div className="rounded-3xl border border-green-100 bg-green-50 p-5 text-center space-y-3">
          <p className="text-green-700 font-semibold text-sm">
            ✅ {t("MESA_CHECKOUT_ORDER_SENT", "Pedido enviado para a cozinha!")}
          </p>
          <p className="text-xs text-gray-500">
            {t("MESA_CHECKOUT_PAY_NOW", "Deseja pagar agora?")}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setPayScreen("pix")}
              className="flex-1 rounded-xl bg-blue-500 py-3 text-sm font-semibold text-white hover:opacity-90"
            >
              {t("MESA_CHECKOUT_PIX_SHORT", "PIX")}
            </button>
            <button
              onClick={() => setPayScreen("terminal")}
              className="flex-1 rounded-xl bg-rosso py-3 text-sm font-semibold text-white hover:opacity-90"
            >
              {t("MESA_CHECKOUT_TERMINAL_SHORT", "Maquininha")}
            </button>
          </div>
          <a href="/cardapio" className="block text-xs text-gray-400 underline">
            {t("MESA_CHECKOUT_PAY_LATER", "Pagar depois")}
          </a>
        </div>
      )}

      {payScreen === "pix" && createdOrderId && (
        <PixScreen
          orderId={createdOrderId}
          total={createdOrderTotal}
          onClose={() => setPayScreen(null)}
        />
      )}
      {payScreen === "terminal" && createdOrderId && (
        <TerminalScreen
          orderId={createdOrderId}
          total={createdOrderTotal}
          onClose={() => setPayScreen(null)}
        />
      )}
    </main>
  );
}

export default MesaCheckoutPage;
