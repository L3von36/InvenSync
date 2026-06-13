'use client'

import { useLanguageStore } from '@/lib/stores/language-store'

// ============================================
// InvenSync Internationalization (i18n) System
// Supports English and Amharic
// ============================================

export type Language = 'en' | 'am'

export interface TranslationDict {
  // Navigation
  nav: {
    dashboard: string
    products: string
    productTypes: string
    inventory: string
    sales: string
    customers: string
    debts: string
    reports: string
    aiInventory: string
    aiAssistant: string
    settings: string
    suppliers: string
    services: string
    branches: string
    modules: string
    expenses: string
    stockTransfers: string
    purchaseOrders: string
    loyalty: string
    creditLimits: string
    smartSearch: string
    auditLog: string
    scheduledReports: string
    adminDashboard: string
    adminOrganizations: string
    adminUsers: string
    adminModules: string
    adminSalesTeam: string
    adminNotifications: string
    adminRegions: string
    more: string
    home: string
  }
  // Common actions
  actions: {
    add: string
    edit: string
    delete: string
    save: string
    cancel: string
    search: string
    filter: string
    export: string
    import: string
    refresh: string
    close: string
    confirm: string
    submit: string
    reset: string
    back: string
    next: string
    previous: string
    view: string
    create: string
    update: string
    remove: string
    download: string
    upload: string
    print: string
    share: string
    copy: string
    clear: string
    apply: string
    approve: string
    reject: string
    send: string
    loading: string
    retry: string
  }
  // Common labels
  labels: {
    name: string
    email: string
    phone: string
    amount: string
    date: string
    time: string
    description: string
    status: string
    type: string
    category: string
    price: string
    quantity: string
    total: string
    subtotal: string
    discount: string
    tax: string
    balance: string
    payment: string
    note: string
    address: string
    city: string
    country: string
    reference: string
    code: string
    sku: string
    unit: string
    brand: string
    supplier: string
    customer: string
    product: string
    shop: string
    warehouse: string
    organization: string
    role: string
    password: string
    confirmPassword: string
    businessType: string
    currency: string
    language: string
    theme: string
  }
  // Status labels
  status: {
    active: string
    inactive: string
    pending: string
    completed: string
    cancelled: string
    approved: string
    rejected: string
    draft: string
    paid: string
    unpaid: string
    partial: string
    overdue: string
    delivered: string
    shipped: string
    ordered: string
    returned: string
    expired: string
    requested: string
    processing: string
    failed: string
  }
  // Form labels and placeholders
  form: {
    selectDate: string
    selectOption: string
    searchPlaceholder: string
    namePlaceholder: string
    emailPlaceholder: string
    phonePlaceholder: string
    descriptionPlaceholder: string
    pricePlaceholder: string
    quantityPlaceholder: string
    requiredField: string
    invalidEmail: string
    invalidPhone: string
    passwordMismatch: string
    passwordTooShort: string
    fieldRequired: string
    noResults: string
    selectAll: string
    deselectAll: string
  }
  // Error messages
  errors: {
    somethingWentWrong: string
    networkError: string
    unauthorized: string
    forbidden: string
    notFound: string
    serverError: string
    sessionExpired: string
    loginFailed: string
    registrationFailed: string
    duplicateEntry: string
    deleteFailed: string
    updateFailed: string
    createFailed: string
    loadFailed: string
    saveFailed: string
    validationError: string
    insufficientStock: string
    permissionDenied: string
  }
  // Currency
  currency: {
    etb: string
    usd: string
    eur: string
    gbp: string
    ethiopianBirr: string
    usDollar: string
    euro: string
    britishPound: string
  }
  // Misc
  misc: {
    welcome: string
    goodbye: string
    noData: string
    loading: string
    saving: string
    deleting: string
    updating: string
    creating: string
    confirmDelete: string
    confirmLogout: string
    areYouSure: string
    yes: string
    no: string
    ok: string
    from: string
    to: string
    of: string
    and: string
    or: string
    all: string
    none: string
    other: string
    today: string
    yesterday: string
    thisWeek: string
    thisMonth: string
    thisYear: string
    totalItems: string
    showing: string
    page: string
    outOf: string
    poweredBy: string
    version: string
  }
}

// ============================================
// English Translations
// ============================================
const en: TranslationDict = {
  nav: {
    dashboard: 'Dashboard',
    products: 'Products',
    productTypes: 'Product Types',
    inventory: 'Inventory',
    sales: 'Sales',
    customers: 'Customers',
    debts: 'Debts & Credits',
    reports: 'Reports',
    aiInventory: 'AI Inventory',
    aiAssistant: 'AI Assistant',
    settings: 'Settings',
    suppliers: 'Suppliers',
    services: 'Services',
    branches: 'Branches',
    modules: 'Modules',
    expenses: 'Expenses',
    stockTransfers: 'Stock Transfers',
    purchaseOrders: 'Purchase Orders',
    loyalty: 'Customer Loyalty',
    creditLimits: 'Credit Limits',
    smartSearch: 'Smart Search',
    auditLog: 'Audit Log',
    scheduledReports: 'Scheduled Reports',
    adminDashboard: 'Admin Dashboard',
    adminOrganizations: 'Organizations',
    adminUsers: 'Users',
    adminModules: 'Modules & Pricing',
    adminSalesTeam: 'Sales Team',
    adminNotifications: 'Notifications',
    adminRegions: 'Regions & Cities',
    more: 'More',
    home: 'Home',
  },
  actions: {
    add: 'Add',
    edit: 'Edit',
    delete: 'Delete',
    save: 'Save',
    cancel: 'Cancel',
    search: 'Search',
    filter: 'Filter',
    export: 'Export',
    import: 'Import',
    refresh: 'Refresh',
    close: 'Close',
    confirm: 'Confirm',
    submit: 'Submit',
    reset: 'Reset',
    back: 'Back',
    next: 'Next',
    previous: 'Previous',
    view: 'View',
    create: 'Create',
    update: 'Update',
    remove: 'Remove',
    download: 'Download',
    upload: 'Upload',
    print: 'Print',
    share: 'Share',
    copy: 'Copy',
    clear: 'Clear',
    apply: 'Apply',
    approve: 'Approve',
    reject: 'Reject',
    send: 'Send',
    loading: 'Loading...',
    retry: 'Retry',
  },
  labels: {
    name: 'Name',
    email: 'Email',
    phone: 'Phone',
    amount: 'Amount',
    date: 'Date',
    time: 'Time',
    description: 'Description',
    status: 'Status',
    type: 'Type',
    category: 'Category',
    price: 'Price',
    quantity: 'Quantity',
    total: 'Total',
    subtotal: 'Subtotal',
    discount: 'Discount',
    tax: 'Tax',
    balance: 'Balance',
    payment: 'Payment',
    note: 'Note',
    address: 'Address',
    city: 'City',
    country: 'Country',
    reference: 'Reference',
    code: 'Code',
    sku: 'SKU',
    unit: 'Unit',
    brand: 'Brand',
    supplier: 'Supplier',
    customer: 'Customer',
    product: 'Product',
    shop: 'Shop',
    warehouse: 'Warehouse',
    organization: 'Organization',
    role: 'Role',
    password: 'Password',
    confirmPassword: 'Confirm Password',
    businessType: 'Business Type',
    currency: 'Currency',
    language: 'Language',
    theme: 'Theme',
  },
  status: {
    active: 'Active',
    inactive: 'Inactive',
    pending: 'Pending',
    completed: 'Completed',
    cancelled: 'Cancelled',
    approved: 'Approved',
    rejected: 'Rejected',
    draft: 'Draft',
    paid: 'Paid',
    unpaid: 'Unpaid',
    partial: 'Partial',
    overdue: 'Overdue',
    delivered: 'Delivered',
    shipped: 'Shipped',
    ordered: 'Ordered',
    returned: 'Returned',
    expired: 'Expired',
    requested: 'Requested',
    processing: 'Processing',
    failed: 'Failed',
  },
  form: {
    selectDate: 'Select date',
    selectOption: 'Select an option',
    searchPlaceholder: 'Search...',
    namePlaceholder: 'Enter name',
    emailPlaceholder: 'Enter email address',
    phonePlaceholder: 'Enter phone number',
    descriptionPlaceholder: 'Enter description',
    pricePlaceholder: 'Enter price',
    quantityPlaceholder: 'Enter quantity',
    requiredField: 'This field is required',
    invalidEmail: 'Invalid email address',
    invalidPhone: 'Invalid phone number',
    passwordMismatch: 'Passwords do not match',
    passwordTooShort: 'Password is too short',
    fieldRequired: 'Field is required',
    noResults: 'No results found',
    selectAll: 'Select all',
    deselectAll: 'Deselect all',
  },
  errors: {
    somethingWentWrong: 'Something went wrong',
    networkError: 'Network error. Please check your connection.',
    unauthorized: 'You are not authorized',
    forbidden: 'Access denied',
    notFound: 'Not found',
    serverError: 'Server error',
    sessionExpired: 'Session expired. Please log in again.',
    loginFailed: 'Login failed. Please check your credentials.',
    registrationFailed: 'Registration failed. Please try again.',
    duplicateEntry: 'This entry already exists',
    deleteFailed: 'Failed to delete',
    updateFailed: 'Failed to update',
    createFailed: 'Failed to create',
    loadFailed: 'Failed to load data',
    saveFailed: 'Failed to save',
    validationError: 'Validation error',
    insufficientStock: 'Insufficient stock',
    permissionDenied: 'Permission denied',
  },
  currency: {
    etb: 'ETB',
    usd: 'USD',
    eur: 'EUR',
    gbp: 'GBP',
    ethiopianBirr: 'Ethiopian Birr',
    usDollar: 'US Dollar',
    euro: 'Euro',
    britishPound: 'British Pound',
  },
  misc: {
    welcome: 'Welcome',
    goodbye: 'Goodbye',
    noData: 'No data available',
    loading: 'Loading...',
    saving: 'Saving...',
    deleting: 'Deleting...',
    updating: 'Updating...',
    creating: 'Creating...',
    confirmDelete: 'Are you sure you want to delete this?',
    confirmLogout: 'Are you sure you want to log out?',
    areYouSure: 'Are you sure?',
    yes: 'Yes',
    no: 'No',
    ok: 'OK',
    from: 'From',
    to: 'To',
    of: 'of',
    and: 'and',
    or: 'or',
    all: 'All',
    none: 'None',
    other: 'Other',
    today: 'Today',
    yesterday: 'Yesterday',
    thisWeek: 'This Week',
    thisMonth: 'This Month',
    thisYear: 'This Year',
    totalItems: 'Total Items',
    showing: 'Showing',
    page: 'Page',
    outOf: 'of',
    poweredBy: 'Powered by',
    version: 'Version',
  },
}

// ============================================
// Amharic Translations
// ============================================
const am: TranslationDict = {
  nav: {
    dashboard: 'ዳሽቦርድ',
    products: 'ምርቶች',
    productTypes: 'የምርት ዓይነቶች',
    inventory: 'እቃዎች',
    sales: 'ሽያጭ',
    customers: 'ደንበኞች',
    debts: 'ዕዳ እና ብድር',
    reports: 'ሪፖርቶች',
    aiInventory: 'AI እቃዎች',
    aiAssistant: 'AI ረዳት',
    settings: 'ቅንብሮች',
    suppliers: 'አቅራቢዎች',
    services: 'አገልግሎቶች',
    branches: 'ቅርንጫፎች',
    modules: 'ሞዱሎች',
    expenses: 'ወጪዎች',
    stockTransfers: 'የእቃ ዝውውር',
    purchaseOrders: 'የግዢ ትዕዛዞች',
    loyalty: 'የደንበኛ ታማኝነት',
    creditLimits: 'የብድር ገደብ',
    smartSearch: 'ስማሪት ፍለጋ',
    auditLog: 'የኦዲት ምዝገባ',
    scheduledReports: 'የቀጠሮ ሪፖርቶች',
    adminDashboard: 'የአስተዳዳሪ ዳሽቦርድ',
    adminOrganizations: 'ድርጅቶች',
    adminUsers: 'ተጠቃሚዎች',
    adminModules: 'ሞዱሎች እና ዋጋ',
    adminSalesTeam: 'የሽያጭ ቡድን',
    adminNotifications: 'ማሳወቂያዎች',
    adminRegions: 'ክልሎች እና ከተሞች',
    more: 'ተጨማሪ',
    home: 'መነሻ',
  },
  actions: {
    add: 'መጨመር',
    edit: 'ማስተካከል',
    delete: 'መሰረዝ',
    save: 'ማስቀመጥ',
    cancel: 'ማስረጃ',
    search: 'ፍለጋ',
    filter: 'አጣራ',
    export: 'ላክ',
    import: 'ቀሠም',
    refresh: 'አድስ',
    close: 'ዝጋ',
    confirm: 'አረጋግጥ',
    submit: 'ላክ',
    reset: 'ዳግም አስጀምር',
    back: 'ተመለስ',
    next: 'ቀጥል',
    previous: 'ቀዳሚ',
    view: 'ተመልከት',
    create: 'ፍጠር',
    update: 'አዘምን',
    remove: 'አስወግድ',
    download: 'አውርድ',
    upload: 'ጫን',
    print: 'አትም',
    share: 'አጋራ',
    copy: 'ቅጂ',
    clear: 'አጽዳ',
    apply: 'ተግብር',
    approve: 'አጽድቅ',
    reject: 'ውድቅ',
    send: 'ላክ',
    loading: 'እየጫነ ነው...',
    retry: 'እንደገና ሞክር',
  },
  labels: {
    name: 'ስም',
    email: 'ኢሜል',
    phone: 'ስልክ',
    amount: 'መጠን',
    date: 'ቀን',
    time: 'ሰዓት',
    description: 'መግለጫ',
    status: 'ሁኔታ',
    type: 'ዓይነት',
    category: 'ምድብ',
    price: 'ዋጋ',
    quantity: 'ብዛት',
    total: 'ጠቅላላ',
    subtotal: 'ንዑስ ድምር',
    discount: 'ቅናሽ',
    tax: 'ግብር',
    balance: 'ሚዛን',
    payment: 'ክፍያ',
    note: 'ማስታወሻ',
    address: 'አድራሻ',
    city: 'ከተማ',
    country: 'ሀገር',
    reference: 'ማመላከቻ',
    code: 'ኮድ',
    sku: 'SKU',
    unit: 'መለክያ',
    brand: 'ምርት ስም',
    supplier: 'አቅራቢ',
    customer: 'ደንበኛ',
    product: 'ምርት',
    shop: 'መደብር',
    warehouse: 'መጋዘን',
    organization: 'ድርጅት',
    role: 'ሚና',
    password: 'የይለፍ ቃል',
    confirmPassword: 'የይለፍ ቃል አረጋግጥ',
    businessType: 'የንግድ ዓይነት',
    currency: 'ገንዘብ',
    language: 'ቋንቋ',
    theme: 'ገጽታ',
  },
  status: {
    active: 'ንቁ',
    inactive: 'ንቁ ያልሆነ',
    pending: 'በመጠባበቅ ላይ',
    completed: 'የተጠናቀቀ',
    cancelled: 'የተሰረዘ',
    approved: 'የጸደቀ',
    rejected: 'ውድቅ የተደረገ',
    draft: 'ረቂቅ',
    paid: 'የተከፈለ',
    unpaid: 'ያልተከፈለ',
    partial: 'የተከፈለ ከፊል',
    overdue: 'የዘገየ',
    delivered: 'የተላከ',
    shipped: 'በመላክ ላይ',
    ordered: 'የታዘዘ',
    returned: 'የተመለሰ',
    expired: 'ያለፈ',
    requested: 'የተጠየቀ',
    processing: 'በሂደት ላይ',
    failed: 'ያልተሳካ',
  },
  form: {
    selectDate: 'ቀን ይምረጡ',
    selectOption: 'አማራጭ ይምረጡ',
    searchPlaceholder: 'ፈልግ...',
    namePlaceholder: 'ስም ያስገቡ',
    emailPlaceholder: 'ኢሜል ያስገቡ',
    phonePlaceholder: 'ስልክ ቁጥር ያስገቡ',
    descriptionPlaceholder: 'መግለጫ ያስገቡ',
    pricePlaceholder: 'ዋጋ ያስገቡ',
    quantityPlaceholder: 'ብዛት ያስገቡ',
    requiredField: 'ይህ መስክ ያስፈልጋል',
    invalidEmail: 'ልክ ያልሆነ ኢሜል',
    invalidPhone: 'ልክ ያልሆነ ስልክ ቁጥር',
    passwordMismatch: 'የይለፍ ቃላት አይመሳሰሉም',
    passwordTooShort: 'የይለፍ ቃል በጣም አጭር ነው',
    fieldRequired: 'መስክ ያስፈልጋል',
    noResults: 'ውጤት አልተገኘም',
    selectAll: 'ሁሉንም ምረጥ',
    deselectAll: 'ሁሉንም አፅዳ',
  },
  errors: {
    somethingWentWrong: 'የሆነ ችግር ተከስቷል',
    networkError: 'የአውታረ መረብ ችግር። እባክዎ ግንኙነትዎን ያረጋግጡ።',
    unauthorized: 'ለዚህ ተግባር ፍቃድ የለዎትም',
    forbidden: 'መዳረሻ ውድቅ ተደርጓል',
    notFound: 'አልተገኘም',
    serverError: 'የሰርቨር ችግር',
    sessionExpired: 'ክፍለ ጊዜ አልፎታል። እባክዎ እንደገና ይግቡ።',
    loginFailed: 'መግባት አልተሳካም። እባክዎ መረጃዎን ያረጋግጡ።',
    registrationFailed: 'ምዝገባ አልተሳካም። እባክዎ እንደገና ይሞክሩ።',
    duplicateEntry: 'ይህ ግቤት አስቀድሞ አለ',
    deleteFailed: 'መሰረዝ አልተሳካም',
    updateFailed: 'ማዘመን አልተሳካም',
    createFailed: 'መፍጠር አልተሳካም',
    loadFailed: 'ውሂብ መጫን አልተሳካም',
    saveFailed: 'ማስቀመጥ አልተሳካም',
    validationError: 'የማረጋገጫ ችግር',
    insufficientStock: 'በቂ እቃ የለም',
    permissionDenied: 'ፍቃድ ውድቅ ተደርጓል',
  },
  currency: {
    etb: 'ETB',
    usd: 'USD',
    eur: 'EUR',
    gbp: 'GBP',
    ethiopianBirr: 'የኢትዮጵያ ብር',
    usDollar: 'የአሜሪካ ዶላር',
    euro: 'አውሮ',
    britishPound: 'የእንግሊዝ ፓውንድ',
  },
  misc: {
    welcome: 'እንኳን ደህና መጡ',
    goodbye: 'ደህና ይሁንልዎ',
    noData: 'ውሂብ የለም',
    loading: 'እየጫነ ነው...',
    saving: 'እያስቀመጠ ነው...',
    deleting: 'እያጠፋ ነው...',
    updating: 'እያዘመነ ነው...',
    creating: 'እያቀነቀነ ነው...',
    confirmDelete: 'እርግጠኛ ኖት መሰረዝ ይፈልጋሉ?',
    confirmLogout: 'እርግጠኛ ኖት መውጣት ይፈልጋሉ?',
    areYouSure: 'እርግጠኛ ኖት?',
    yes: 'አዎ',
    no: 'አይ',
    ok: 'እሺ',
    from: 'ከ',
    to: 'ወደ',
    of: 'ከ',
    and: 'እና',
    or: 'ወይም',
    all: 'ሁሉም',
    none: 'ምንም',
    other: 'ሌላ',
    today: 'ዛሬ',
    yesterday: 'ትናንት',
    thisWeek: 'የዚህ ሳምንት',
    thisMonth: 'የዚህ ወር',
    thisYear: 'የዚህ ዓመት',
    totalItems: 'ጠቅላላ እቃዎች',
    showing: 'እያሳየ',
    page: 'ገጽ',
    outOf: 'ከ',
    poweredBy: 'በ',
    version: 'ስሪት',
  },
}

// ============================================
// Translation Dictionary Map
// ============================================
const translations: Record<Language, TranslationDict> = { en, am }

// ============================================
// t() function - get a nested translation by dot-notation key
// ============================================
type NestedKeyOf<T> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends object
        ? `${K}` | `${K}.${NestedKeyOf<T[K]>}`
        : `${K}`
    }[keyof T & string]
  : never

export type TranslationKey = NestedKeyOf<TranslationDict>

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split('.')
  let current: unknown = obj
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return path // fallback to key if path is invalid
    }
    current = (current as Record<string, unknown>)[key]
  }
  return typeof current === 'string' ? current : path
}

export function t(key: TranslationKey | string, lang?: Language): string {
  const language = lang || (typeof window !== 'undefined'
    ? (localStorage.getItem('invensync-language') as Language) || 'en'
    : 'en')
  const dict = translations[language] || translations.en
  return getNestedValue(dict as unknown as Record<string, unknown>, key)
}

// ============================================
// useTranslation hook
// ============================================
export function useTranslation() {
  const language = useLanguageStore((state) => state.language)

  const dict = translations[language] || translations.en

  const translate = (key: TranslationKey | string): string => {
    return getNestedValue(dict as unknown as Record<string, unknown>, key)
  }

  return {
    t: translate,
    language,
    dict,
    isAmharic: language === 'am',
    isEnglish: language === 'en',
  }
}

// ============================================
// Export dictionaries for direct access
// ============================================
export { en, am, translations }
