'use client'

import { Banknote } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useCurrency } from '@/lib/currency-context'

export function CurrencySwitcher() {
  const { displayCurrency, setDisplayCurrency, supportedCurrencies, baseCurrency } = useCurrency()

  const currentCurrency = supportedCurrencies.find((c) => c.code === displayCurrency) || supportedCurrencies[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors w-full"
          aria-label="Switch currency"
        >
          <Banknote className="size-4" />
          <span className="flex-1 text-left truncate">
            {currentCurrency.flag} {currentCurrency.code}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-52">
        {supportedCurrencies.map((currency) => (
          <DropdownMenuItem
            key={currency.code}
            onClick={() => setDisplayCurrency(currency.code)}
            className={displayCurrency === currency.code ? 'bg-accent' : ''}
          >
            <span className="mr-2">{currency.flag}</span>
            <span className="flex-1">{currency.code}</span>
            <span className="text-xs text-muted-foreground ml-1">
              {currency.name}
            </span>
            {displayCurrency === currency.code && (
              <span className="ml-1 text-xs text-muted-foreground">✓</span>
            )}
          </DropdownMenuItem>
        ))}
        {baseCurrency !== 'ETB' && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground border-t mt-1 pt-2">
            Base: {baseCurrency}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
