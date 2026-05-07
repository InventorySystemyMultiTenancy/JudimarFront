const statusSteps = [
  { key: "RECEBIDO", label: "Recebido" },
  { key: "PREPARANDO", label: "Preparando" },
  { key: "PRONTO", label: "Pronto" },
  { key: "SAIU_PARA_ENTREGA", label: "Saiu para Entrega" },
  { key: "ENTREGUE", label: "Entregue" },
];

function OrderTracker({ status = "RECEBIDO" }) {
  const activeIndex = statusSteps.findIndex((step) => step.key === status);
  const isCancelled = status === "CANCELADO";

  return (
    <section className="rounded-3xl border border-gold/20 bg-lacquer/70 p-4 sm:p-6">
      <h3 className="font-display text-xl text-gold">Timeline do Pedido</h3>

      {isCancelled ? (
        <div className="mt-6 flex items-center gap-3 rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full border border-red-400 bg-red-500/20 text-red-400 text-xs font-bold">
            ✕
          </span>
          <p className="font-semibold text-red-400">Pedido Cancelado</p>
        </div>
      ) : (
        <ol className="mt-6 space-y-4">
          {statusSteps.map((step, index) => {
            const done = index < activeIndex;
            const active = index === activeIndex;

            return (
              <li
                key={step.key}
                className="relative pl-10 transition-all duration-300"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <span
                  className={`absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold transition-all duration-300 ${
                    active
                      ? "animate-pulse border-gold bg-gold text-black shadow-[0_0_12px_rgba(212,169,77,0.6)]"
                      : done
                        ? "border-gold bg-gold text-black"
                        : "border-gray-300 bg-gray-50 text-smoke"
                  }`}
                >
                  {done ? (
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={3}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </span>
                <p
                  className={`font-semibold transition-colors duration-300 ${
                    active ? "text-gold" : done ? "text-gray-900" : "text-smoke"
                  }`}
                >
                  {step.label}
                </p>
                {index < statusSteps.length - 1 ? (
                  <span
                    className={`absolute left-[13px] top-7 h-6 w-px transition-colors duration-500 ${
                      done ? "bg-gold/50" : "bg-white/15"
                    }`}
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export default OrderTracker;
