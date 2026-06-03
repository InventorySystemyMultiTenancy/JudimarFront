import Swal from "sweetalert2";

export const PAYMENT_METHOD_OPTIONS = {
  CREDITO: "Crédito",
  DEBITO: "Débito",
  PIX: "Pix",
  DINHEIRO: "Dinheiro",
  VOUCHER: "Voucher",
};

export async function askPaymentMethod({
  title = "Forma de pagamento",
  text = "Escolha como o cliente pagou.",
  confirmButtonText = "Confirmar pagamento",
  cancelButtonText = "Cancelar",
} = {}) {
  const result = await Swal.fire({
    title,
    text,
    input: "radio",
    inputOptions: PAYMENT_METHOD_OPTIONS,
    inputValidator: (value) =>
      value ? undefined : "Selecione a forma de pagamento.",
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText,
    confirmButtonColor: "#0f172a",
  });

  return result.isConfirmed ? result.value : null;
}
