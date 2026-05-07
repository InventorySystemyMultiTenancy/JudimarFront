import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

function CheckoutMock() {
  const [method, setMethod] = useState("PIX");

  return (
    <section className="rounded-3xl border border-gold/20 bg-lacquer/70 p-4 sm:p-6">
      <h2 className="font-display text-2xl text-gold">Pagamento</h2>

      <div className="mt-4 grid grid-cols-2 gap-2">
        {["PIX", "CARTAO"].map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setMethod(option)}
            className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
              method === option
                ? "border-ember bg-ember/20 text-white"
                : "border-white/10 bg-black/30 text-smoke"
            }`}
          >
            {option === "PIX" ? "PIX" : "Cartao"}
          </button>
        ))}
      </div>

      {method === "PIX" ? (
        <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4 text-center">
          <p className="mb-3 text-sm text-smoke">
            Escaneie o QR Code para pagar
          </p>
          <div className="mx-auto flex h-52 w-52 items-center justify-center rounded-2xl bg-white p-4">
            <QRCodeSVG value="pix://pizzariachina/checkout/123456" size={180} />
          </div>
          <p className="mt-3 text-xs text-smoke">
            Pedido confirmado apos aprovacao do pagamento.
          </p>
        </div>
      ) : (
        <div className="mt-5 space-y-3 rounded-2xl border border-white/10 bg-black/30 p-4">
          <input
            type="text"
            placeholder="Numero do cartao"
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-sm outline-none focus:border-gold"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="MM/AA"
              className="rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-sm outline-none focus:border-gold"
            />
            <input
              type="text"
              placeholder="CVV"
              className="rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-sm outline-none focus:border-gold"
            />
          </div>
          <input
            type="text"
            placeholder="Nome no cartao"
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-3 text-sm outline-none focus:border-gold"
          />
        </div>
      )}
    </section>
  );
}

export default CheckoutMock;
