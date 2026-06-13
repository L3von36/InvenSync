// ============================================
// InvenSync Multi-Currency Support
// Base currency: ETB (Ethiopian Birr)
// All data stored in ETB; display currency converts on-the-fly
// ============================================

export interface CurrencyInfo {
  code: string
  name: string
  symbol: string
  flag: string
  decimalPlaces: number
}

export const SUPPORTED_CURRENCIES: CurrencyInfo[] = [
  { code: 'ETB', name: 'Ethiopian Birr', symbol: 'Br', flag: '🇪🇹', decimalPlaces: 2 },
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸', decimalPlaces: 2 },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺', decimalPlaces: 2 },
  { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧', decimalPlaces: 2 },
]

// ============================================
// Fixed exchange rates (relative to ETB)
// These are approximate and used for display only
// ============================================
const EXCHANGE_RATES_TO_ETB: Record<string, number> = {
  ETB: 1,
  USD: 57,   // 1 USD ≈ 57 ETB
  EUR: 62,   // 1 EUR ≈ 62 ETB
  GBP: 72,   // 1 GBP ≈ 72 ETB
}

/**
 * Convert an amount from one currency to another
 * All conversions go through ETB as the base currency
 */
export function convertCurrency(
  amount: number,
  from: string,
  to: string,
  rate?: number
): number {
  if (from === to) return amount

  // If a custom rate is provided, use it
  if (rate !== undefined) {
    return amount * rate
  }

  const fromRate = EXCHANGE_RATES_TO_ETB[from]
  const toRate = EXCHANGE_RATES_TO_ETB[to]

  if (!fromRate || !toRate) return amount

  // Convert: amount in `from` -> ETB -> `to`
  const amountInETB = amount * fromRate
  const result = amountInETB / toRate

  return result
}

/**
 * Get the currency symbol for a given currency code
 */
export function getCurrencySymbol(currency: string): string {
  const info = SUPPORTED_CURRENCIES.find((c) => c.code === currency)
  return info?.symbol || currency
}

/**
 * Get the number of decimal places for a currency
 */
export function getCurrencyDecimalPlaces(currency: string): number {
  const info = SUPPORTED_CURRENCIES.find((c) => c.code === currency)
  return info?.decimalPlaces ?? 2
}

/**
 * Format an amount with the appropriate currency symbol and decimals
 * If a displayCurrency is provided (and differs from baseCurrency),
 * the amount is converted before formatting.
 */
export function formatCurrency(
  amount: number,
  currency: string = 'ETB',
  displayCurrency?: string
): string {
  const targetCurrency = displayCurrency || currency
  const convertedAmount = displayCurrency && displayCurrency !== currency
    ? convertCurrency(amount, currency, targetCurrency)
    : amount

  const symbol = getCurrencySymbol(targetCurrency)
  const decimals = getCurrencyDecimalPlaces(targetCurrency)
  const formatted = convertedAmount.toFixed(decimals)

  // For ETB, put symbol after the number (Br 1,234.56)
  // For others, put symbol before ($1,234.56)
  if (targetCurrency === 'ETB') {
    return `${symbol} ${addThousandSeparator(formatted)}`
  }

  return `${symbol}${addThousandSeparator(formatted)}`
}

/**
 * Add thousand separators to a number string
 */
function addThousandSeparator(numStr: string): string {
  const parts = numStr.split('.')
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return parts.length > 1 ? `${intPart}.${parts[1]}` : intPart
}

/**
 * Safe ETB currency formatter that won't throw RangeError
 * in environments where the 'en-ET' locale or 'ETB' currency code
 * is not supported by Intl.NumberFormat.
 */
export function formatETB(value: number): string {
  try {
    const formatter = new Intl.NumberFormat('en-ET', { style: 'currency', currency: 'ETB' })
    return formatter.format(value)
  } catch {
    // Fallback: manually format with the Br symbol and thousand separators
    const decimals = 2
    const formatted = Math.abs(value).toFixed(decimals)
    const withSeparators = addThousandSeparator(formatted)
    const sign = value < 0 ? '-' : ''
    return `${sign}Br ${withSeparators}`
  }
}

/**
 * Get exchange rate from one currency to another
 */
export function getExchangeRate(from: string, to: string): number {
  if (from === to) return 1
  const fromRate = EXCHANGE_RATES_TO_ETB[from]
  const toRate = EXCHANGE_RATES_TO_ETB[to]
  if (!fromRate || !toRate) return 1
  return fromRate / toRate
}

/**
 * Get all exchange rates relative to ETB
 */
export function getExchangeRates(): Record<string, number> {
  return { ...EXCHANGE_RATES_TO_ETB }
}
