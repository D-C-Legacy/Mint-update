export const CURRENCY = { code: "USD", locale: "en-US", symbol: "$" } as const;
const formatter = new Intl.NumberFormat(CURRENCY.locale, {
  style: "currency",
  currency: CURRENCY.code,
  maximumFractionDigits: 0,
});
export const formatUSD = (value: number) => formatter.format(value);
