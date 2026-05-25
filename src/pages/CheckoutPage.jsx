import { useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { api } from "../lib/api.js";
import { useTranslation } from "../context/I18nContext.jsx";

const FREE_DELIVERY_RADIUS_KM = 5;
const PIZZARIA_WHATSAPP =
  import.meta.env.VITE_PIZZARIA_WHATSAPP || "5511971174080";

const currency = (v) =>
  Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const toNumber = (value) => {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    return Number(value.replace(",", "."));
  }
  return Number.NaN;
};

const applyFreeDeliveryRadius = (freightData) => {
  if (!freightData) return freightData;

  const distanceKm = toNumber(freightData.distanciaKm);
  if (!Number.isFinite(distanceKm) || distanceKm > FREE_DELIVERY_RADIUS_KM) {
    return freightData;
  }

  return {
    ...freightData,
    valorFreteNumerico: 0,
    valorFrete: currency(0),
    freteGratisPorDistancia: true,
  };
};

const formatCep = (v) => {
  const d = v.replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

const isValidEntityId = (value) => String(value || "").trim().length > 0;

const buildOrderItemsMessage = (items) =>
  items
    .map((item) => {
      const unitPrice = Number(item.price || item.basePrice || 0);
      const addonsTotal = (item.addons || []).reduce(
        (sum, addon) => sum + Number(addon?.price || 0),
        0,
      );
      const itemTotal = (unitPrice + addonsTotal) * item.quantity;
      const details = [
        item.description,
        item.addons?.length
          ? `Adicionais: ${item.addons
              .map((addon) => addon?.nome || addon?.name || addon?.label)
              .filter(Boolean)
              .join(", ")}`
          : "",
        item.removals?.length ? `Sem: ${item.removals.join(", ")}` : "",
        item.observation ? `Obs: ${item.observation}` : "",
      ].filter(Boolean);

      return [
        `- ${item.quantity}x ${item.title || item.nome || item.name || "Item"} (${currency(itemTotal)})`,
        ...details.map((detail) => `  ${detail}`),
      ].join("\n");
    })
    .join("\n");

const buildWhatsAppUrl = ({
  order,
  user,
  items,
  deliveryType,
  paymentMode,
  fullAddress,
  referencia,
  notes,
  subtotal,
  freight,
  total,
}) => {
  const shortOrderId = order?.id
    ? `#${String(order.id).slice(-6).toUpperCase()}`
    : "novo pedido";
  const phone = PIZZARIA_WHATSAPP.replace(/\D/g, "");
  const customerLines = [
    `Nome: ${user?.name || "Nao informado"}`,
    user?.phone ? `Telefone: ${user.phone}` : "",
    user?.email ? `Email: ${user.email}` : "",
    user?.cpf ? `CPF: ${user.cpf}` : "",
    user?.address ? `Endereco cadastrado: ${user.address}` : "",
  ].filter(Boolean);
  const deliveryLines =
    deliveryType === "retirada"
      ? ["Tipo: Retirada no local"]
      : [
          "Tipo: Entrega",
          `Endereco: ${fullAddress || "Nao informado"}`,
          referencia ? `Referencia: ${referencia}` : "",
          freight?.distanciaKm ? `Distancia: ${freight.distanciaKm} km` : "",
        ].filter(Boolean);
  const paymentLabel =
    paymentMode === "online"
      ? "Pagar pelo WhatsApp"
      : "Pagar na entrega/retirada";

  const message = [
    `Ola! Pedido ${shortOrderId} realizado pelo site.`,
    "",
    "DADOS DO CLIENTE",
    ...customerLines,
    "",
    "ENTREGA",
    ...deliveryLines,
    "",
    "ITENS",
    buildOrderItemsMessage(items),
    "",
    "VALORES",
    `Subtotal: ${currency(subtotal)}`,
    `Frete: ${currency(freight?.valorFreteNumerico || 0)}`,
    `Total: ${currency(total)}`,
    "",
    "PAGAMENTO",
    paymentLabel,
    notes ? `Observacoes do pedido: ${notes}` : "",
  ]
    .filter((line) => line !== "")
    .join("\n");

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
};

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

function CheckoutPage() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { t } = useTranslation();
  const { items, subtotal, clearCart } = useCart();
  const [paymentMode, setPaymentMode] = useState("online");

  // Address
  const [cep, setCep] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [referencia, setReferencia] = useState("");
  const [rua, setRua] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [notes, setNotes] = useState("");

  // Freight
  const [freight, setFreight] = useState(null);
  const [freightLoading, setFreightLoading] = useState(false);
  const [freightError, setFreightError] = useState("");
  const [deliveryType, setDeliveryType] = useState("entrega"); // "entrega" | "retirada"

  // ViaCEP auto-fill
  const fetchViaCep = useCallback(async (rawCep) => {
    const clean = rawCep.replace(/\D/g, "");
    if (clean.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const data = await res.json();
      if (data.erro) {
        setFreightError("CEP não encontrado.");
        return;
      }
      setRua(data.logradouro || "");
      setBairro(data.bairro || "");
      setCidade(data.localidade || "");
      setFreightError("");
    } catch {
      // silent
    }
  }, []);

  const handleCepChange = (e) => {
    const formatted = formatCep(e.target.value);
    setCep(formatted);
    setFreight(null);
    if (formatted.replace(/\D/g, "").length === 8) {
      fetchViaCep(formatted);
    }
  };

  const calculateFreight = async () => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) {
      setFreightError("Informe um CEP válido com 8 dígitos.");
      return;
    }
    if (!numero.trim()) {
      setFreightError("Informe o número do endereço.");
      return;
    }
    setFreightLoading(true);
    setFreightError("");
    setFreight(null);
    try {
      const res = await api.post("/delivery/calculate", {
        cep,
        numero: numero.trim(),
        cidade: cidade.trim() || "São Paulo",
        rua: rua.trim() || undefined,
        complemento: complemento.trim() || undefined,
      });
      setFreight(applyFreeDeliveryRadius(res.data?.data));
    } catch (err) {
      const msg =
        err?.response?.data?.error?.message ||
        "Não foi possível calcular o frete. Verifique o endereço.";
      setFreightError(msg);
    } finally {
      setFreightLoading(false);
    }
  };

  const fullAddress =
    deliveryType === "retirada"
      ? "Retirada no local"
      : [rua, numero, complemento, bairro, cidade].filter(Boolean).join(", ");

  const effectiveFreight =
    deliveryType === "retirada"
      ? { valorFreteNumerico: 0, valorFrete: "R$\u00a00,00" }
      : freight;

  const totalWithFreight =
    subtotal + (effectiveFreight?.valorFreteNumerico ?? 0);

  const createOrderMutation = useMutation({
    mutationFn: async (paymentMethod) => {
      const payload = {
        deliveryAddress: fullAddress || "Endereço não informado",
        isPickup: deliveryType === "retirada",
        notes: [notes, referencia ? `Ref: ${referencia}` : ""]
          .filter(Boolean)
          .join(" | "),
        paymentMethod,
        deliveryFee: effectiveFreight?.valorFreteNumerico ?? undefined,
        deliveryLat: effectiveFreight?.lat ?? undefined,
        deliveryLon: effectiveFreight?.lon ?? undefined,
        items: items.map(mapItemToApi).filter(Boolean),
      };

      console.log("[CheckoutPage] create order payload", {
        paymentMethod,
        itemsCount: payload.items.length,
        firstItem: payload.items[0] ?? null,
        payload,
      });

      const response = await api.post("/orders", payload);
      return response.data?.data || response.data;
    },
  });

  const handleConfirmOrder = async () => {
    const whatsappTab = window.open("about:blank", "_blank");
    try {
      const order = await createOrderMutation.mutateAsync(
        paymentMode === "online" ? "PIX" : "PRESENCIAL",
      );
      const whatsappUrl = buildWhatsAppUrl({
        order,
        user,
        items,
        deliveryType,
        paymentMode,
        fullAddress,
        referencia,
        notes,
        subtotal,
        freight: effectiveFreight,
        total: totalWithFreight,
      });

      if (whatsappTab) {
        whatsappTab.opener = null;
        whatsappTab.location.href = whatsappUrl;
      } else {
        toast.success("Pedido confirmado! Abrindo WhatsApp.");
        clearCart();
        window.location.href = whatsappUrl;
        return;
      }

      toast.success("Pedido confirmado! Abrindo WhatsApp.");
      clearCart();
      navigate("/dashboard");
    } catch (err) {
      if (whatsappTab) {
        whatsappTab.close();
      }
      const data = err?.response?.data;
      const details = data?.error?.details?.fieldErrors;
      const detailText = details ? JSON.stringify(details) : null;
      console.error("[CheckoutPage] create order failed", {
        status: err?.response?.status,
        data,
      });
      toast.error(
        data?.error?.message
          ? `${data.error.message}${detailText ? `: ${detailText}` : ""}`
          : "Erro ao criar pedido. Tente novamente.",
      );
    }
  };

  const isLoading = createOrderMutation.isPending;

  const canConfirm =
    isAuthenticated &&
    items.length > 0 &&
    subtotal > 0 &&
    !isLoading &&
    (deliveryType === "retirada" || freight !== null);

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-4 py-6 text-gray-900 sm:px-6">
      <div className="mb-6 flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-500 transition hover:border-gray-400 hover:text-gray-800"
        >
          {t("BTN_BACK", "← Voltar")}
        </button>
        <h1 className="font-display text-3xl text-gold">Checkout</h1>
      </div>

      {!items.length ? (
        <p className="mt-6 rounded-2xl border border-gray-200 bg-gray-100 p-4 text-sm text-smoke">
          {t("CHECKOUT_EMPTY", "Seu carrinho está vazio.")}
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left: Address + Freight */}
          <section className="space-y-4">
            <div className="rounded-3xl border border-gold/20 bg-white p-5">
              {/* Tipo de entrega */}
              <div className="mb-5 flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeliveryType("entrega")}
                  className={`flex-1 rounded-2xl border py-3 text-sm font-bold transition ${
                    deliveryType === "entrega"
                      ? "border-rosso bg-rosso text-white"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-400"
                  }`}
                >
                  {t("CHECKOUT_DELIVERY", "🛵 Entrega")}
                </button>
                <button
                  type="button"
                  onClick={() => setDeliveryType("retirada")}
                  className={`flex-1 rounded-2xl border py-3 text-sm font-bold transition ${
                    deliveryType === "retirada"
                      ? "border-green-600 bg-green-600 text-white"
                      : "border-gray-200 bg-white text-gray-600 hover:border-gray-400"
                  }`}
                >
                  {t("CHECKOUT_PICKUP", "🏠 Retirada no local")}
                </button>
              </div>

              {deliveryType === "retirada" ? (
                <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-4 text-center">
                  <p className="font-bold text-green-800">
                    {t(
                      "CHECKOUT_PICKUP_FREE",
                      "Retirada no local — Frete grátis",
                    )}
                  </p>
                  <p className="mt-1 text-xs text-green-700">
                    Av. Cachoeira Paulista, 17 — CEP 03551-000, São Paulo
                  </p>
                </div>
              ) : (
                <>
                  <h2 className="font-display text-xl text-gold">
                    {t("CHECKOUT_ADDRESS_TITLE", "Endereço de Entrega")}
                  </h2>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {/* CEP */}
                    <div className="col-span-2 sm:col-span-1">
                      <label className="mb-1 block text-xs font-semibold text-gray-600">
                        {t("CHECKOUT_CEP", "CEP")} *
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="00000-000"
                        value={cep}
                        onChange={handleCepChange}
                        maxLength={9}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-gold/60 focus:outline-none"
                      />
                    </div>

                    {/* Número */}
                    <div className="col-span-2 sm:col-span-1">
                      <label className="mb-1 block text-xs font-semibold text-gray-600">
                        {t("CHECKOUT_NUMBER", "Número")} *
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: 123"
                        value={numero}
                        onChange={(e) => {
                          setNumero(e.target.value);
                          setFreight(null);
                        }}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-gold/60 focus:outline-none"
                      />
                    </div>

                    {/* Rua */}
                    <div className="col-span-2">
                      <label className="mb-1 block text-xs font-semibold text-gray-600">
                        {t("CHECKOUT_STREET", "Rua")}
                      </label>
                      <input
                        type="text"
                        placeholder="Preenchido automaticamente pelo CEP"
                        value={rua}
                        onChange={(e) => setRua(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-gold/60 focus:outline-none"
                      />
                    </div>

                    {/* Complemento */}
                    <div className="col-span-2 sm:col-span-1">
                      <label className="mb-1 block text-xs font-semibold text-gray-600">
                        {t("CHECKOUT_COMPLEMENT", "Complemento")}
                      </label>
                      <input
                        type="text"
                        placeholder="Apto, bloco, casa..."
                        value={complemento}
                        onChange={(e) => setComplemento(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-gold/60 focus:outline-none"
                      />
                    </div>

                    {/* Bairro */}
                    <div className="col-span-2 sm:col-span-1">
                      <label className="mb-1 block text-xs font-semibold text-gray-600">
                        {t("CHECKOUT_NEIGHBORHOOD", "Bairro")}
                      </label>
                      <input
                        type="text"
                        placeholder="Preenchido pelo CEP"
                        value={bairro}
                        onChange={(e) => setBairro(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm focus:border-gold/60 focus:outline-none"
                      />
                    </div>

                    {/* Referência */}
                    <div className="col-span-2">
                      <label className="mb-1 block text-xs font-semibold text-gray-600">
                        {t("CHECKOUT_REFERENCE", "Ponto de referência")}
                      </label>
                      <input
                        type="text"
                        placeholder="Ex: próximo ao mercado, portão azul..."
                        value={referencia}
                        onChange={(e) => setReferencia(e.target.value)}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-gold/60 focus:outline-none"
                      />
                    </div>

                    {/* Obs */}
                    <div className="col-span-2">
                      <label className="mb-1 block text-xs font-semibold text-gray-600">
                        {t("CHECKOUT_NOTES_LABEL", "Observações do pedido")}
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Ex: sem cebola, borda recheada..."
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-gold/60 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Calculate freight */}
                  <button
                    type="button"
                    disabled={freightLoading}
                    onClick={calculateFreight}
                    className="mt-4 w-full rounded-2xl bg-rosso py-3 text-sm font-bold text-white transition hover:bg-ember disabled:opacity-50"
                  >
                    {freightLoading
                      ? t("BTN_CALC_FREIGHT_LOADING", "Calculando frete...")
                      : t("BTN_CALC_FREIGHT", "Calcular Frete 🛵")}
                  </button>

                  {freightError && (
                    <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {freightError}
                    </p>
                  )}

                  {freight && (
                    <div className="mt-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-3">
                      <p className="text-sm font-bold text-green-800">
                        Frete: {freight.valorFrete}
                        {freight.freteGratisPorDistancia
                          ? " (gratis ate 5 km)"
                          : ""}
                      </p>
                      <p className="mt-0.5 text-xs text-green-700">
                        Distância: {freight.distanciaKm} km · Tempo estimado: ~
                        {freight.tempoEstimado} min
                      </p>
                      <p
                        className="mt-0.5 text-xs text-green-600 line-clamp-1"
                        title={freight.displayName}
                      >
                        📍 {freight.displayName}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          {/* Right: Summary + Payment */}
          <section className="space-y-4">
            <div className="rounded-3xl border border-gold/20 bg-white p-5">
              <h2 className="font-display text-xl text-gold">Resumo</h2>
              <ul className="mt-4 space-y-2 text-sm">
                {items.map((item) => (
                  <li
                    key={item.key}
                    className="flex items-start justify-between gap-3"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">
                        {item.title}
                      </p>
                      <p className="text-xs text-smoke">{item.description}</p>
                    </div>
                    <p className="shrink-0 font-semibold text-gold">
                      x{item.quantity}
                    </p>
                  </li>
                ))}
              </ul>
              <div className="mt-4 border-t border-gray-100 pt-4 space-y-1 text-sm">
                <div className="flex justify-between text-smoke">
                  <span>Subtotal</span>
                  <span>{currency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-smoke">
                  <span>Frete</span>
                  <span
                    className={
                      effectiveFreight ? "font-semibold text-green-700" : ""
                    }
                  >
                    {deliveryType === "retirada"
                      ? "R$ 0,00"
                      : freight
                        ? freight.valorFrete
                        : "— calcule o frete"}
                  </span>
                </div>
                <div className="flex justify-between pt-1 text-base font-bold text-gold">
                  <span>Total</span>
                  <span>{currency(totalWithFreight)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-gold/20 bg-white p-5">
              <h2 className="font-display text-xl text-gold">Pagamento</h2>
              <div className="mt-3 flex rounded-2xl border border-gray-200 bg-gray-50 p-1">
                <button
                  type="button"
                  onClick={() => setPaymentMode("online")}
                  className={`flex-1 rounded-xl py-3 text-sm font-semibold transition ${
                    paymentMode === "online"
                      ? "bg-rosso text-white shadow"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  💳 Pagar pelo WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMode("presencial")}
                  className={`flex-1 rounded-xl py-3 text-sm font-semibold transition ${
                    paymentMode === "presencial"
                      ? "bg-white text-gray-900 shadow"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  💵 Pagar na Entrega
                </button>
              </div>

              {paymentMode === "online" ? (
                <div className="mt-3 rounded-2xl border border-gold/20 bg-gray-50 p-4">
                  <p className="text-sm font-bold text-gray-900">
                    Confirmacao pelo WhatsApp
                  </p>
                  <ul className="mt-3 space-y-1 text-xs text-smoke">
                    <li>✅ Pedido enviado com todos os dados para a equipe</li>
                    <li>✅ Combine Pix, cartao ou confirmacao pelo WhatsApp</li>
                  </ul>
                </div>
              ) : (
                <div className="mt-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4">
                  <p className="text-xs font-bold text-amber-800">
                    ⚠️ O preparo só inicia após confirmação do pagamento pela
                    equipe.
                  </p>
                  <p className="mt-1 text-xs text-amber-700">
                    Aceitos: dinheiro, cartão na maquininha.
                  </p>
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={!canConfirm}
              onClick={handleConfirmOrder}
              className="w-full rounded-2xl bg-rosso px-5 py-4 text-base font-bold text-white shadow-md transition hover:bg-ember disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading
                ? "Processando..."
                : paymentMode === "online"
                  ? "Confirmar e abrir WhatsApp →"
                  : "Confirmar pedido no WhatsApp →"}
            </button>
          </section>
        </div>
      )}
    </main>
  );
}

export default CheckoutPage;
