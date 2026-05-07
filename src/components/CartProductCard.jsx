const currency = (value) =>
  Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

const addonTotal = (addons = []) =>
  addons.reduce((sum, addon) => sum + Number(addon?.price || 0), 0);

function CartProductCard({
  item,
  onQuantityChange,
  onRemove,
  onObservationChange,
}) {
  const nome = item.nome || item.title || "Produto";
  const observation = item.observation ?? item.notes ?? "";
  const unit = Number(item.price || 0) + addonTotal(item.addons || []);

  return (
    <article className="rounded-2xl border border-[#2a313d] bg-[#161c25] p-3 text-[#e8ebf2] transition-all hover:border-amber-400/40">
      <h4 className="font-semibold text-[#f2f4f8]">{nome}</h4>

      {item.addons?.length ? (
        <div className="mt-1.5 space-y-1">
          {item.addons.map((addon) => (
            <p key={addon.id || addon.nome} className="text-xs text-amber-300">
              + {addon.nome} ({currency(addon.price)})
            </p>
          ))}
        </div>
      ) : null}

      {item.removals?.length ? (
        <p className="mt-1 text-xs text-[#9da5b7]">
          Remocoes: {item.removals.join(", ")}
        </p>
      ) : null}

      <div className="mt-3">
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[#8f97aa]">
          Observacao
        </label>
        <textarea
          rows={2}
          placeholder="Ex: sem molho"
          value={observation}
          onChange={(event) => onObservationChange(event.target.value)}
          className="w-full resize-none rounded-xl border border-[#2a313d] bg-[#0f141b] px-3 py-2 text-sm text-[#dae0ec] outline-none placeholder:text-[#6f788b] focus:border-amber-400/60"
        />
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="h-9 w-9 rounded-xl border border-[#343d4c] bg-[#111722] text-lg"
            onClick={() => onQuantityChange(item.quantity - 1)}
          >
            -
          </button>
          <span className="w-7 text-center text-sm">{item.quantity}</span>
          <button
            type="button"
            className="h-9 w-9 rounded-xl border border-[#343d4c] bg-[#111722] text-lg"
            onClick={() => onQuantityChange(item.quantity + 1)}
          >
            +
          </button>
        </div>

        <div className="text-right">
          <p className="text-sm font-bold text-amber-400">
            {currency(unit * item.quantity)}
          </p>
          <button
            type="button"
            onClick={onRemove}
            className="text-xs text-red-400"
          >
            remover
          </button>
        </div>
      </div>
    </article>
  );
}

export default CartProductCard;
