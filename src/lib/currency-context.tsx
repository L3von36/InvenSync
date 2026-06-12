'use client'

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import {
  formatCurrency,
  convertCurrency,
  getCurrencySymbol,
  getExchangeRate,
  SUPPORTED_CURRENCIES,
  type CurrencyInfo,
} from '@/lib/currency'

const DISPLAY_CURRENCY_KEY = 'invensync-display-currency'

interface CurrencyContextValue {
  /** The base currency (from org, typically ETB) */
  baseCurrency: string
  /** The user's preferred display currency */
  displayCurrency: string
  /** Set the display currency preference */
  setDisplayCurrency: (currency: string) => void
  /** Format an amount using display currency */
  format: (amount: number, baseCurrencyOverride?: string) => string
  /** Convert an amount from base currency to display currency */
  convert: (amount: number, from?: string) => number
  /** Get the symbol for the current display currency */
  symbol: string
  /** Get the exchange rate from base to display currency */
  exchangeRate: number
  /** List of supported currencies */
  supportedCurrencies: CurrencyInfo[]
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null)

interface CurrencyProviderProps {
  children: ReactNode
  /** Base currency for the organization (defaults to ETB) */
  baseCurrency?: string
}

export function CurrencyProvider({
  children,
  baseCurrency = 'ETB',
}: CurrencyProviderProps) {
  const [displayCurrency, setDisplayCurrencyState] = useState<string>(() => {
    if (typeof window === 'undefined') return baseCurrency
    const saved = localStorage.getItem(DISPLAY_CURRENCY_KEY)
    return saved || baseCurrency
  })

  const setDisplayCurrency = useCallback(
    (currency: string) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem(DISPLAY_CURRENCY_KEY, currency)
      }
      setDisplayCurrencyState(currency)
    },
    []
  )

  // Sync with localStorage changes from other tabs
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === DISPLAY_CURRENCY_KEY && e.newValue) {
        setDisplayCurrencyState(e.newValue)
      }
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const symbol = getCurrencySymbol(displayCurrency)
  const exchangeRate = getExchangeRate(baseCurrency, displayCurrency)

  const format = useCallback(
    (amount: number, baseCurrencyOverride?: string) => {
      return formatCurrency(amount, baseCurrencyOverride || baseCurrency, displayCurrency)
    },
    [baseCurrency, displayCurrency]
  )

  const convert = useCallback(
    (amount: number, from?: string) => {
      return convertCurrency(amount, from || baseCurrency, displayCurrency)
    },
    [baseCurrency, displayCurrency]
  )

  const value: CurrencyContextValue = {
    baseCurrency,
    displayCurrency,
    setDisplayCurrency,
    format,
    convert,
    symbol,
    exchangeRate,
    supportedCurrencies: SUPPORTED_CURRENCIES,
  }

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency(): CurrencyContextValue {
  const context = useContext(CurrencyContext)
  if (!context) {
    // Return a safe default if used outside provider
    return {
      baseCurrency: 'ETB',
      displayCurrency: 'ETB',
      setDisplayCurrency: () => {},
      format: (amount: number) => formatCurrency(amount, 'ETB', 'ETB'),
      convert: (amount: number) => amount,
      symbol: 'Br',
      exchangeRate: 1,
      supportedCurrencies: SUPPORTED_CURRENCIES,
    }
  }
  return context
}
