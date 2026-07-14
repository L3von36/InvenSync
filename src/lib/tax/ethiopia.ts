// ============================================
// Ethiopian tax rules — configuration and pure calculators
// ============================================
// All rates, bands, and thresholds live here as effective-dated DATA so a
// directive change ships as a config update, never a logic change.
//
// Legal basis (see docs in ~/Documents/Ethiopian_Tax_Research_20260714):
// - Income Tax (Amendment) Proclamation No. 1395/2025 (effective 7 Jul 2025):
//   two taxpayer categories (A > 2M ETB turnover, B <= 2M), Category B
//   presumptive tax on gross sales (2-9%), Minimum Alternative Tax 2.5%,
//   TOT abolished, cash payments > 50,000 ETB prohibited.
// - VAT Proclamation No. 1341/2024 (effective 21 Aug 2024): 15% rate,
//   registration threshold 2M ETB taxable supplies in 12 months.
// - Tax Administration Proclamation No. 983/2016: penalties/interest.
//
// EVERYTHING HERE PRODUCES ESTIMATES. The gazetted Amharic text and
// Ministry of Revenues directives are authoritative; band boundaries are
// sourced from professional legal analyses and must be re-verified when
// directives are issued.

export interface TaxBand {
  /** Inclusive upper bound of the band in ETB; null = no upper bound */
  upTo: number | null
  /** Rate as a fraction (0.03 = 3%) */
  rate: number
}

export interface EthiopiaTaxConfig {
  /** ISO date this config takes effect (start of Ethiopian FY 2025/26) */
  effectiveFrom: string
  legalBasis: string[]
  /** Category A/B classification threshold — annual turnover in ETB */
  categoryThresholdETB: number
  /** Category B: presumptive tax on annual GROSS SALES (flat rate per band) */
  categoryBBands: TaxBand[]
  /** Category A individuals: progressive schedule on annual TAXABLE INCOME */
  individualBusinessBands: TaxBand[]
  /** Category A bodies (PLC, share company): flat rate on taxable profit */
  corporateRate: number
  /** Minimum Alternative Tax: fraction of annual turnover */
  matRate: number
  vat: {
    standardRate: number
    /** Registration mandatory above this taxable turnover in any 12 months */
    registrationThresholdETB: number
  }
  withholding: {
    /** Rate withheld on qualifying purchases of goods/services */
    localRate: number
    goodsThresholdETB: number
    servicesThresholdETB: number
    /** Rate when supplier has no TIN / valid trade license */
    noTinRate: number
  }
  /** Employment income tax (monthly, progressive) — for payroll awareness */
  employmentBands: TaxBand[]
  /** Cash payments above this amount per transaction are prohibited */
  cashPaymentCapETB: number
  fiscalYear: {
    /** Gregorian month (1-12) and day the Ethiopian fiscal year starts */
    startMonth: number
    startDay: number
  }
  deadlines: {
    /** Months after fiscal year end for the annual declaration + payment */
    annualReturnMonthsAfterFYE: number
    /** Days after each fiscal quarter for advance payments */
    advancePaymentDaysAfterQuarter: number
  }
}

export const ETHIOPIA_TAX_CONFIG: EthiopiaTaxConfig = {
  effectiveFrom: '2025-07-07',
  legalBasis: [
    'Income Tax (Amendment) Proclamation No. 1395/2025',
    'VAT Proclamation No. 1341/2024',
    'Federal Tax Administration Proclamation No. 983/2016',
  ],
  categoryThresholdETB: 2_000_000,
  categoryBBands: [
    { upTo: 100_000, rate: 0.02 },
    { upTo: 500_000, rate: 0.03 },
    { upTo: 1_000_000, rate: 0.05 },
    { upTo: 1_500_000, rate: 0.07 },
    { upTo: 2_000_000, rate: 0.09 },
  ],
  individualBusinessBands: [
    { upTo: 24_000, rate: 0 },
    { upTo: 48_000, rate: 0.15 },
    { upTo: 84_000, rate: 0.2 },
    { upTo: 120_000, rate: 0.25 },
    { upTo: 168_000, rate: 0.3 },
    { upTo: null, rate: 0.35 },
  ],
  corporateRate: 0.3,
  matRate: 0.025,
  vat: {
    standardRate: 0.15,
    registrationThresholdETB: 2_000_000,
  },
  withholding: {
    localRate: 0.03,
    goodsThresholdETB: 20_000,
    servicesThresholdETB: 10_000,
    noTinRate: 0.3,
  },
  employmentBands: [
    { upTo: 2_000, rate: 0 },
    { upTo: 4_000, rate: 0.15 },
    { upTo: 7_000, rate: 0.2 },
    { upTo: 10_000, rate: 0.25 },
    { upTo: 14_000, rate: 0.3 },
    { upTo: null, rate: 0.35 },
  ],
  cashPaymentCapETB: 50_000,
  fiscalYear: {
    // Ethiopian fiscal year: Hamle 1 – Sene 30 ≈ 8 July – 7 July
    startMonth: 7,
    startDay: 8,
  },
  deadlines: {
    annualReturnMonthsAfterFYE: 4,
    advancePaymentDaysAfterQuarter: 30,
  },
}

export const TAX_DISCLAIMER =
  'These figures are estimates computed from your InvenSync records under ' +
  'Proclamation 1395/2025 and related laws. They are not tax advice and not ' +
  'an official assessment — always confirm with the Ministry of Revenues or ' +
  'a licensed accountant before filing.'

// ============================================
// Calculators (pure functions)
// ============================================

export type TaxpayerCategory = 'A' | 'B'
export type LegalForm = 'individual' | 'entity'

export interface TaxProfile {
  legalForm: LegalForm
  vatRegistered: boolean
  /** Professional service provider — always Category A regardless of turnover */
  isProfessional: boolean
  /** Shop keeps full books voluntarily — treated as Category A */
  keepsBooks: boolean
  hasEmployees: boolean
  tinNumber?: string
}

/** Suggest the taxpayer category from turnover + profile facts. */
export function suggestCategory(
  annualTurnoverETB: number,
  profile: Pick<TaxProfile, 'legalForm' | 'vatRegistered' | 'isProfessional' | 'keepsBooks'>,
  config: EthiopiaTaxConfig = ETHIOPIA_TAX_CONFIG
): TaxpayerCategory {
  if (profile.legalForm === 'entity') return 'A'
  if (profile.vatRegistered || profile.isProfessional || profile.keepsBooks) return 'A'
  return annualTurnoverETB > config.categoryThresholdETB ? 'A' : 'B'
}

/** Category B: flat band rate applied to TOTAL gross sales. */
export function computeCategoryBTax(
  grossSalesETB: number,
  config: EthiopiaTaxConfig = ETHIOPIA_TAX_CONFIG
): { tax: number; rate: number; band: TaxBand } {
  const sales = Math.max(0, grossSalesETB)
  const band =
    config.categoryBBands.find((b) => b.upTo === null || sales <= b.upTo) ??
    config.categoryBBands[config.categoryBBands.length - 1]
  return { tax: sales * band.rate, rate: band.rate, band }
}

/** Progressive schedule (marginal rates) over annual taxable income. */
export function computeProgressiveTax(
  amountETB: number,
  bands: TaxBand[]
): number {
  let remaining = Math.max(0, amountETB)
  let lower = 0
  let tax = 0
  for (const band of bands) {
    const width = band.upTo === null ? remaining : Math.min(remaining, band.upTo - lower)
    if (width <= 0) break
    tax += width * band.rate
    remaining -= width
    lower = band.upTo ?? lower
    if (remaining <= 0) break
  }
  return tax
}

/** Category A estimate: regular tax vs the 2.5% MAT floor. */
export function computeCategoryATax(
  taxableIncomeETB: number,
  annualTurnoverETB: number,
  legalForm: LegalForm,
  config: EthiopiaTaxConfig = ETHIOPIA_TAX_CONFIG
): { regularTax: number; mat: number; payable: number; matApplies: boolean } {
  const income = Math.max(0, taxableIncomeETB)
  const regularTax =
    legalForm === 'entity'
      ? income * config.corporateRate
      : computeProgressiveTax(income, config.individualBusinessBands)
  const mat = Math.max(0, annualTurnoverETB) * config.matRate
  const matApplies = mat > regularTax
  return { regularTax, mat, payable: matApplies ? mat : regularTax, matApplies }
}

/** Monthly PAYE for one employee's salary. */
export function computeEmploymentTax(
  monthlySalaryETB: number,
  config: EthiopiaTaxConfig = ETHIOPIA_TAX_CONFIG
): number {
  return computeProgressiveTax(monthlySalaryETB, config.employmentBands)
}

// ============================================
// Fiscal calendar
// ============================================

export interface FiscalYearBounds {
  start: Date
  end: Date
  /** e.g. "2025/26" */
  label: string
}

/** Ethiopian fiscal year containing `date` (8 July – 7 July). */
export function getFiscalYearBounds(
  date: Date = new Date(),
  config: EthiopiaTaxConfig = ETHIOPIA_TAX_CONFIG
): FiscalYearBounds {
  const { startMonth, startDay } = config.fiscalYear
  const thisYearStart = new Date(date.getFullYear(), startMonth - 1, startDay)
  const start =
    date >= thisYearStart
      ? thisYearStart
      : new Date(date.getFullYear() - 1, startMonth - 1, startDay)
  const end = new Date(start.getFullYear() + 1, startMonth - 1, startDay - 1, 23, 59, 59, 999)
  const label = `${start.getFullYear()}/${String(end.getFullYear()).slice(2)}`
  return { start, end, label }
}

export interface TaxDeadline {
  id: string
  title: string
  due: Date
  description: string
  appliesTo: 'all' | 'vat' | 'payroll'
}

/** Upcoming deadlines for the fiscal year containing `now`. */
export function getTaxDeadlines(
  now: Date = new Date(),
  profile?: Pick<TaxProfile, 'vatRegistered' | 'hasEmployees'>,
  config: EthiopiaTaxConfig = ETHIOPIA_TAX_CONFIG
): TaxDeadline[] {
  const fy = getFiscalYearBounds(now, config)
  const deadlines: TaxDeadline[] = []

  // Quarterly advance payments: 30 days after each fiscal quarter end
  for (let q = 1; q <= 4; q++) {
    const quarterEnd = new Date(fy.start)
    quarterEnd.setMonth(quarterEnd.getMonth() + q * 3)
    quarterEnd.setDate(quarterEnd.getDate() - 1)
    const due = new Date(quarterEnd)
    due.setDate(due.getDate() + config.deadlines.advancePaymentDaysAfterQuarter)
    deadlines.push({
      id: `advance-q${q}`,
      title: `Quarterly advance payment (Q${q})`,
      due,
      description: 'Advance income tax based on prior-year liability, due within 30 days of the quarter end.',
      appliesTo: 'all',
    })
  }

  // Annual declaration: last day of the 4th month after fiscal year end
  const annualDue = new Date(fy.end)
  annualDue.setMonth(annualDue.getMonth() + config.deadlines.annualReturnMonthsAfterFYE)
  deadlines.push({
    id: 'annual-return',
    title: `Annual tax declaration (FY ${fy.label})`,
    due: annualDue,
    description: 'Annual income tax declaration and payment of any balance for the fiscal year.',
    appliesTo: 'all',
  })

  // Monthly obligations: next occurrence only (end of following month)
  const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 0)
  if (profile?.vatRegistered) {
    deadlines.push({
      id: 'vat-monthly',
      title: 'Monthly VAT declaration',
      due: nextMonthEnd,
      description: `VAT return for ${now.toLocaleString('en-US', { month: 'long' })}, due by the end of the following month.`,
      appliesTo: 'vat',
    })
  }
  if (profile?.hasEmployees) {
    deadlines.push({
      id: 'paye-monthly',
      title: 'Employee income tax (PAYE) remittance',
      due: nextMonthEnd,
      description: `Withheld employment income tax for ${now.toLocaleString('en-US', { month: 'long' })}, due by the end of the following month.`,
      appliesTo: 'payroll',
    })
  }

  return deadlines
    .filter((d) => d.due >= now)
    .sort((a, b) => a.due.getTime() - b.due.getTime())
}

// ============================================
// Threshold monitoring
// ============================================

export interface ThresholdStatus {
  trailing12moTurnover: number
  thresholdETB: number
  /** 0..1+ */
  ratio: number
  level: 'ok' | 'approaching' | 'warning' | 'critical' | 'exceeded'
}

export function getThresholdStatus(
  trailing12moTurnover: number,
  config: EthiopiaTaxConfig = ETHIOPIA_TAX_CONFIG
): ThresholdStatus {
  const ratio = trailing12moTurnover / config.categoryThresholdETB
  const level =
    ratio >= 1 ? 'exceeded'
    : ratio >= 0.95 ? 'critical'
    : ratio >= 0.85 ? 'warning'
    : ratio >= 0.7 ? 'approaching'
    : 'ok'
  return {
    trailing12moTurnover,
    thresholdETB: config.categoryThresholdETB,
    ratio,
    level,
  }
}
