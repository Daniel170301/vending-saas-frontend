export const CURRENCY_OPTIONS = [
  { code: "PEN", label: "S/ Sol peruano", locale: "es-PE" },
  { code: "USD", label: "$ Dólar", locale: "en-US" },
  { code: "EUR", label: "€ Euro", locale: "es-ES" },
  { code: "MXN", label: "$ Peso mexicano", locale: "es-MX" },
  { code: "COP", label: "$ Peso colombiano", locale: "es-CO" },
  { code: "ARS", label: "$ Peso argentino", locale: "es-AR" },
  { code: "CLP", label: "$ Peso chileno", locale: "es-CL" },
  { code: "BRL", label: "R$ Real", locale: "pt-BR" },
];

let _currency = "PEN";
let _locale = "es-PE";

export const setMoneyCurrency = (code?: string | null) => {
  const opt = CURRENCY_OPTIONS.find((c) => c.code === (code || "PEN"));
  _currency = opt?.code || "PEN";
  _locale = opt?.locale || "es-PE";
};

export const fmtMoney = (n: number | string | null | undefined) => {
  const v = typeof n === "string" ? parseFloat(n) : (n ?? 0);
  return new Intl.NumberFormat(_locale, { style: "currency", currency: _currency, maximumFractionDigits: 2 }).format(v || 0);
};
export const fmtNumber = (n: number | string | null | undefined) => {
  const v = typeof n === "string" ? parseFloat(n) : (n ?? 0);
  return new Intl.NumberFormat(_locale).format(v || 0);
};
