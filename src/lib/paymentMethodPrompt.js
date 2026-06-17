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
  includePending = false,
  returnDetails = false,
} = {}) {
  const inputOptions = includePending
    ? { ...PAYMENT_METHOD_OPTIONS, PENDENTE: "Pendente" }
    : PAYMENT_METHOD_OPTIONS;

  const result = await Swal.fire({
    title,
    text,
    input: "radio",
    inputOptions,
    inputValidator: (value) =>
      value ? undefined : "Selecione a forma de pagamento.",
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText,
    confirmButtonColor: "#0f172a",
  });

  if (!result.isConfirmed) return null;

  if (result.value !== "PENDENTE") {
    return returnDetails ? { paymentMethod: result.value } : result.value;
  }

  const customerResult = await Swal.fire({
    title: "Pagamento pendente",
    text: "Informe o nome do cliente.",
    input: "text",
    inputPlaceholder: "Nome do cliente",
    inputValidator: (value) =>
      value?.trim() ? undefined : "Informe o nome do cliente.",
    showCancelButton: true,
    confirmButtonText: "Salvar pendente",
    cancelButtonText,
    confirmButtonColor: "#0f172a",
  });

  if (!customerResult.isConfirmed) return null;

  const pendingCustomerName = customerResult.value.trim();
  return returnDetails
    ? { paymentMethod: "PENDENTE", pendingCustomerName }
    : "PENDENTE";
}
