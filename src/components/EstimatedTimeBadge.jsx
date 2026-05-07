import { formatExpectedTime, getOrderEta } from "../lib/orderEta.js";

const TONE_STYLES = {
  info: "border-sky-300 bg-sky-100 text-sky-700",
  warning: "border-amber-300 bg-amber-100 text-amber-700",
  danger: "border-red-300 bg-red-100 text-red-700",
  success: "border-green-300 bg-green-100 text-green-700",
  neutral: "border-gray-300 bg-gray-100 text-gray-700",
};

function EstimatedTimeBadge({ order, now, compact = false }) {
  const eta = getOrderEta(order, now);

  if (!eta) {
    return null;
  }

  const toneClass = TONE_STYLES[eta.tone] ?? TONE_STYLES.neutral;

  if (compact) {
    return (
      <span
        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClass}`}
      >
        {eta.shortLabel}
      </span>
    );
  }

  return (
    <div className={`rounded-2xl border px-3 py-2 text-sm ${toneClass}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold">Tempo estimado</span>
        <span className="font-bold">{eta.shortLabel}</span>
      </div>
      {!eta.isFinal && eta.expectedAt ? (
        <p className="mt-1 text-xs opacity-80">
          Previsão aproximada: {formatExpectedTime(eta.expectedAt)}
        </p>
      ) : null}
      {eta.isOverdue ? (
        <p className="mt-1 text-xs opacity-80">
          Pedido acima do tempo previsto.
        </p>
      ) : null}
    </div>
  );
}

export default EstimatedTimeBadge;
