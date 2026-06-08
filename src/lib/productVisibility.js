const normalize = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

export const isViagemCategory = (category) => normalize(category) === "viagem";

export const isBebidasCategory = (category) => {
  const normalized = normalize(category);
  return normalized === "bebida" || normalized === "bebidas";
};

export const isPorcoesCategory = (category) => {
  const normalized = normalize(category);
  return normalized === "porcao" || normalized === "porcoes";
};

export const isViagemProduct = (product) => isViagemCategory(product?.category);

export const isViagemPanelProduct = (product) =>
  isViagemProduct(product) ||
  isBebidasCategory(product?.category) ||
  isPorcoesCategory(product?.category);

export const isRegularProduct = (product) => !isViagemProduct(product);
