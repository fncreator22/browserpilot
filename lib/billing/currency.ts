/**
 * Multi-Currency Pricing & Conversion Service
 * 
 * Supports USD ($) and INR (₹) across User Profile, Plans, Checkout, and Billing.
 * Zero em-dashes, strictly typed, safe for Client and Server bundles.
 */

export type SupportedCurrency = "USD" | "INR";

export interface CurrencyConfig {
  code: SupportedCurrency;
  symbol: string;
  label: string;
  exchangeRateFromUsd: number;
}

export const SUPPORTED_CURRENCIES: Record<SupportedCurrency, CurrencyConfig> = {
  USD: {
    code: "USD",
    symbol: "$",
    label: "USD ($)",
    exchangeRateFromUsd: 1.0,
  },
  INR: {
    code: "INR",
    symbol: "₹",
    label: "INR (₹)",
    exchangeRateFromUsd: 85.0,
  },
};

// Canonical tier prices by currency
export const TIER_PRICES: Record<string, Record<SupportedCurrency, { monthly: number; yearly: number }>> = {
  FREE: {
    USD: { monthly: 0, yearly: 0 },
    INR: { monthly: 0, yearly: 0 },
  },
  PREMIUM: {
    USD: { monthly: 19, yearly: 190 },
    INR: { monthly: 1499, yearly: 14990 },
  },
  ENTERPRISE: {
    USD: { monthly: 99, yearly: 990 },
    INR: { monthly: 7999, yearly: 79990 },
  },
};

/**
 * Format monetary amount with appropriate symbol and localized grouping
 */
export function formatCurrency(amount: number, currency: SupportedCurrency | string = "USD"): string {
  const cleanCode = (currency?.toUpperCase() === "INR" ? "INR" : "USD") as SupportedCurrency;
  const config = SUPPORTED_CURRENCIES[cleanCode];

  if (amount === 0) {
    return `${config.symbol}0`;
  }

  if (cleanCode === "INR") {
    return `${config.symbol}${Math.round(amount).toLocaleString("en-IN")}`;
  }

  return `${config.symbol}${Number.isInteger(amount) ? amount : amount.toFixed(2)}`;
}

/**
 * Resolve price for a given plan code, interval, and selected currency
 */
export function getPlanPrice(
  planCode: string,
  interval: "MONTHLY" | "YEARLY" = "MONTHLY",
  currency: SupportedCurrency | string = "USD"
): { amount: number; symbol: string; formatted: string; rawMonthly: number } {
  const cleanCode = (currency?.toUpperCase() === "INR" ? "INR" : "USD") as SupportedCurrency;
  const normPlan = (planCode || "FREE").toUpperCase();
  const planTier = TIER_PRICES[normPlan] || TIER_PRICES.FREE;
  const priceData = planTier[cleanCode] || planTier.USD;
  const amount = interval === "YEARLY" ? priceData.yearly : priceData.monthly;
  const rawMonthly = priceData.monthly;

  return {
    amount,
    symbol: SUPPORTED_CURRENCIES[cleanCode].symbol,
    formatted: formatCurrency(amount, cleanCode),
    rawMonthly,
  };
}

