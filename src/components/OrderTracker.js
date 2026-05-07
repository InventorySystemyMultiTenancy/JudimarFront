const statusSteps = [
  { key: "RECEBIDO", label: "Recebido" },
  { key: "PREPARANDO", label: "Preparando" },
  { key: "PRONTO", label: "Pronto" },
  { key: "SAIU_PARA_ENTREGA", label: "Saiu para Entrega" },
  { key: "ENTREGUE", label: "Entregue" },
];

function OrderTracker({ status = "RECEBIDO" }) {
  const activeIndex = statusSteps.findIndex((step) => step.key === status);

  return (
    <section className="rounded-3xl border border-gold/20 bg-lacquer/70 p-4 sm:p-6">
      <h3 className="font-display text-xl text-gold">Timeline do Pedido</h3>

      <ol className="mt-6 space-y-4">
        {statusSteps.map((step, index) => {
          const done = index <= activeIndex;

          return (
            <li key={step.key} className="relative pl-10">
              <span
                className={`absolute left-0 top-0 flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold ${
                  done
                    ? "border-gold bg-gold text-black"
                    : "border-white/25 bg-black/20 text-smoke"
                }`}
              >
                {index + 1}
              </span>
              <p
                className={`font-semibold ${done ? "text-white" : "text-smoke"}`}
              >
                {step.label}
              </p>
              {index < statusSteps.length - 1 ? (
                <span className="absolute left-[13px] top-7 h-6 w-px bg-white/15" />
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export default OrderTracker;
