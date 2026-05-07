import { useMemo, useState } from "react";
import { useCart } from "../context/CartContext.jsx";

const DEFAULT_ADDONS = [];

const DEFAULT_REMOVALS = [];

const currency = (value) =>
  Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const getProductPrice = (product) =>
  Number(product?.price ?? product?.basePrice ?? product?.sizes?.[0]?.price ?? 0);

function ProductCustomizer({ product, addonsOptions = DEFAULT_ADDONS, removalOptions = DEFAULT_REMOVALS, onClose }) {
  const { addItem, openCart } = useCart();
  const [selectedAddons, setSelectedAddons] = useState([]);
  const [selectedRemovals, setSelectedRemovals] = useState([]);
  const [observation, setObservation] = useState("");
  const [quantity, setQuantity] = useState(1);

  const basePrice = getProductPrice(product);

  const addonsTotal = useMemo(
    () => selectedAddons.reduce((sum, addon) => sum + Number(addon.price || 0), 0),
    [selectedAddons],
  );

  const unitPrice = basePrice + addonsTotal;
  const totalPrice = unitPrice * quantity;

  const toggleAddon = (addon) => {
    setSelectedAddons((prev) => {
      const exists = prev.some((e) => e.id === addon.id);
      return exists ? prev.filter((e) => e.id !== addon.id) : [...prev, addon];
    });
  };

  const toggleRemoval = (item) => {
    setSelectedRemovals((prev) => prev.includes(item) ? prev.filter((e) => e !== item) : [...prev, item]);
  };

  const handleAddToCart = () => {
    const productId = String(product?.id || "").trim();
    if (!productId) return;

    const keyParts = [
      productId,
      selectedAddons.map((a) => a.id).sort().join("."),
      selectedRemovals.slice().sort().join("."),
      observation.trim(),
    ];

    addItem({
      key: keyParts.join("|"),
      id: productId,
      nome: product?.nome || product?.name,
      price: basePrice,
      addons: selectedAddons,
      removals: selectedRemovals,
      observation: observation.trim(),
      quantity,
      payload: {
        productId,
        addonIds: selectedAddons.map((a) => a.id),
        removedIngredients: selectedRemovals.join(", "),
      },
    });

    openCart();
    if (onClose) onClose();
  };

  return (
    <section className="rounded-xl border border-border-soft bg-white p-5 text-text-main shadow-card-hover sm:p-6">
      <header className="mb-5 border-b border-border-soft pb-4">
        <h2 className="font-display text-xl font-bold text-primary">
          {product?.nome || product?.name}
        </h2>
        {product?.description && (
          <p className="mt-1 text-sm text-text-muted">{product.description}</p>
        )}
        <p className="mt-2 text-base font-semibold text-secondary">{currency(basePrice)}</p>
      </header>

      <div className="space-y-5">
        {/* Extras / Adicionais */}
        {addonsOptions.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
              Adicionais
            </p>
            <div className="space-y-2">
              {addonsOptions.map((addon) => {
                const selected = selectedAddons.some((e) => e.id === addon.id);
                return (
                  <button
                    key={addon.id}
                    type="button"
                    onClick={() => toggleAddon(addon)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-all ${
                      selected
                        ? "border-secondary/60 bg-secondary/5 text-primary"
                        : "border-border-soft bg-accent/40 text-text-muted hover:border-secondary/30"
                    }`}
                  >
                    <span className="text-sm font-medium">{addon.nome}</span>
                    <span className="text-sm font-semibold text-secondary">+ {currency(addon.price)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Remoções */}
        {removalOptions.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
              Remover
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {removalOptions.map((item) => {
                const selected = selectedRemovals.includes(item);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => toggleRemoval(item)}
                    className={`rounded-lg border px-3 py-2 text-sm text-left transition-all ${
                      selected
                        ? "border-primary/40 bg-primary/5 text-primary font-medium"
                        : "border-border-soft text-text-muted hover:border-primary/20"
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Observação */}
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-secondary">
            Observação
          </label>
          <textarea
            rows={3}
            value={observation}
            onChange={(e) => setObservation(e.target.value)}
            placeholder="Ex: sem cebola, molho separado..."
            className="w-full resize-none rounded-lg border border-border-soft bg-accent/30 px-3 py-2 text-sm text-text-main outline-none placeholder:text-text-muted/50 focus:border-secondary/50"
          />
        </div>
      </div>

      {/* Footer com quantidade e total */}
      <footer className="mt-5 rounded-lg border border-border-soft bg-accent/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-text-muted">Quantidade</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border-soft bg-white text-primary hover:bg-primary hover:text-white transition"
            >-</button>
            <span className="w-6 text-center text-sm font-semibold text-primary">{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(20, q + 1))}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border-soft bg-white text-primary hover:bg-primary hover:text-white transition"
            >+</button>
          </div>
        </div>

        {addonsTotal > 0 && (
          <p className="text-xs text-text-muted">Unitário: {currency(unitPrice)}</p>
        )}
        <p className="mt-1 font-display text-2xl font-bold text-secondary">{currency(totalPrice)}</p>

        <button
          type="button"
          onClick={handleAddToCart}
          disabled={!product?.id}
          className="mt-4 w-full rounded-lg bg-primary px-5 py-3 text-sm font-bold text-white transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          Adicionar ao Pedido
        </button>
      </footer>
    </section>
  );
}

export default ProductCustomizer;
