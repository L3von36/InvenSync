'use client'

import { useState } from 'react'
import {
  Package,
  ShoppingCart,
  TrendingUp,
  BarChart3,
  ArrowRight,
  Store,
  Menu,
  X,
  Check,
  Bot,
  CreditCard,
  ShoppingBag,
  Pill,
  Shirt,
  Cpu,
  Scissors,
  Wrench,
} from 'lucide-react'
import { RotatingText } from '@/components/app/landing/rotating-text'
import { ThemeToggle } from '@/components/app/landing/theme-toggle'
import { TestimonialsColumn } from '@/components/ui/testimonials-columns-1'
import { Pricing } from '@/components/ui/pricing'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

// ============================================
// Landing Navbar
// ============================================
function LandingNavbar({ onLogin, onRegister }: { onLogin: () => void; onRegister: () => void }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <nav className="fixed top-4 left-0 right-0 z-50 px-4" aria-label="Main navigation">
      <div className="max-w-5xl mx-auto bg-card/90 backdrop-blur-md rounded-full px-6 h-16 flex items-center justify-between shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-border/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center shadow-md shadow-primary/20">
            <Store className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-foreground text-lg tracking-tight">InvenSync</span>
        </div>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-6">
          <a href="#features" className="text-sm font-semibold text-muted-foreground hover:text-foreground transition">
            Features
          </a>
          <a href="#business-types" className="text-sm font-semibold text-muted-foreground hover:text-foreground transition">
            Business Types
          </a>
          <a href="#pricing" className="text-sm font-semibold text-muted-foreground hover:text-foreground transition">
            Pricing
          </a>
          <ThemeToggle />
          <button
            onClick={onLogin}
            className="text-sm font-semibold text-muted-foreground hover:text-foreground transition"
          >
            Login
          </button>
          <button
            onClick={onRegister}
            className="bg-primary text-primary-foreground text-sm font-bold px-6 py-2.5 rounded-full shadow-lg shadow-primary/20 hover:shadow-xl hover:-translate-y-0.5 transition-all"
          >
            Get Started
          </button>
        </div>

        {/* Mobile Nav */}
        <div className="md:hidden flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-muted-foreground hover:text-foreground transition min-h-11 min-w-11 flex items-center justify-center"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-6 h-6" aria-hidden="true" /> : <Menu className="w-6 h-6" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden mt-2 mx-4 bg-card rounded-2xl shadow-xl border border-border p-4 space-y-2" role="dialog" aria-label="Mobile navigation menu">
          <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition min-h-11">Features</a>
          <a href="#business-types" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition min-h-11">Business Types</a>
          <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition min-h-11">Pricing</a>
          <div className="pt-2 border-t border-border space-y-2">
            <button onClick={() => { onLogin(); setMobileMenuOpen(false) }} className="w-full px-4 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition text-center min-h-11">Login</button>
            <button onClick={() => { onRegister(); setMobileMenuOpen(false) }} className="w-full bg-primary text-primary-foreground text-sm font-bold px-4 py-3 rounded-full shadow-lg hover:shadow-xl transition-all text-center min-h-11">Get Started</button>
          </div>
        </div>
      )}
    </nav>
  )
}

// ============================================
// Hero Section
// ============================================
const heroPhrases = [
  'Grow your business',
  'Track inventory smarter',
  'Increase your profits',
  'Manage sales effortlessly',
  'Control your stock',
  'Make better decisions',
]

function HeroSection({ onRegister }: { onRegister: () => void }) {
  return (
    <section className="relative pt-28 pb-16 sm:pt-36 sm:pb-20 px-5 bg-gradient-to-b from-muted/50 to-background overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-primary/20 dark:bg-primary/10 rounded-full blur-[100px] -z-10 pointer-events-none" />

      <div className="max-w-4xl mx-auto text-center flex flex-col items-center">
        <div className="inline-flex items-center gap-2 bg-card text-muted-foreground px-4 py-2 rounded-full text-sm mb-8 shadow-sm border border-border/50">
          <span className="w-2 h-2 bg-primary rounded-full animate-pulse flex-shrink-0" />
          <span className="opacity-90">Designed for Ethiopian Businesses</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold leading-[1.15] text-foreground tracking-tight mb-6 px-2">
          Everything you need to
          <div className="text-primary mt-1">
            <RotatingText
              phrases={heroPhrases}
              interval={3000}
              className="text-primary font-bold"
            />
          </div>
        </h1>

        <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-4 leading-relaxed px-4">
          Track inventory, record every sale, manage debts, and know your exact profit daily — all in one place.
        </p>

        <p className="text-primary font-semibold mb-8 sm:mb-10 opacity-80 text-sm sm:text-base">
          ክምችት ይከታተሉ · ሽያጭ ይዝግቡ · ትርፍዎን ይወቁ
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <button
            onClick={onRegister}
            className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-full shadow-[0_8px_20px_-6px_rgba(234,88,12,0.4)] hover:shadow-[0_12px_25px_-6px_rgba(234,88,12,0.5)] hover:-translate-y-1 transition-all text-sm"
          >
            Start Free Trial
            <ArrowRight className="w-5 h-5" />
          </button>
          <a
            href="#features"
            className="inline-flex items-center justify-center gap-2 bg-transparent text-muted-foreground hover:text-foreground font-semibold px-6 py-3 rounded-full hover:bg-muted transition-all text-sm border border-transparent"
          >
            Learn More
          </a>
        </div>
      </div>
    </section>
  )
}

// ============================================
// Stats Section
// ============================================
function StatsSection() {
  return (
    <section className="bg-background pb-16 sm:pb-20 px-4 z-10 relative">
      <div className="max-w-5xl mx-auto bg-primary rounded-xl py-8 sm:py-10 px-6 sm:px-8 grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-4 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.2)]">
        <div className="w-full text-center group">
          <div className="text-xl sm:text-2xl font-semibold tabular-nums text-primary-foreground tracking-tight mb-1 group-hover:scale-105 transition-transform origin-center">&lt; 30s</div>
          <div className="text-xs sm:text-sm font-medium text-primary-foreground/70">To record a sale</div>
        </div>
        <div className="w-full text-center group">
          <div className="text-xl sm:text-2xl font-semibold tabular-nums text-primary-foreground tracking-tight mb-1 group-hover:scale-105 transition-transform origin-center">AI</div>
          <div className="text-xs sm:text-sm font-medium text-primary-foreground/70">Powered insights</div>
        </div>
        <div className="w-full text-center group">
          <div className="text-xl sm:text-2xl font-semibold tabular-nums text-primary-foreground tracking-tight mb-1 group-hover:scale-105 transition-transform origin-center">150 ETB</div>
          <div className="text-xs sm:text-sm font-medium text-primary-foreground/70">Monthly flat rate</div>
        </div>
        <div className="w-full text-center group">
          <div className="text-xl sm:text-2xl font-semibold tabular-nums text-primary-foreground tracking-tight mb-1 group-hover:scale-105 transition-transform origin-center">14 Days</div>
          <div className="text-xs sm:text-sm font-medium text-primary-foreground/70">Free trial included</div>
        </div>
      </div>
    </section>
  )
}

// ============================================
// Trusted By Section
// ============================================
function TrustedBySection() {
  const businessTypes = [
    { icon: Cpu, label: 'Electronics' },
    { icon: ShoppingBag, label: 'Retail' },
    { icon: Pill, label: 'Pharmacies' },
    { icon: Shirt, label: 'Fashion' },
    { icon: Wrench, label: 'Hardware' },
    { icon: Scissors, label: 'Salons' },
  ]

  return (
    <section className="py-10 md:py-14 px-5 bg-muted/50 border-y border-border">
      <div className="max-w-5xl mx-auto text-center">
        <p className="text-xs sm:text-sm font-medium text-muted-foreground mb-6 tracking-wide">Trusted by businesses across Ethiopia</p>
        <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
          {businessTypes.map(type => (
            <div key={type.label} className="flex items-center gap-2 text-muted-foreground/60 hover:text-muted-foreground transition-colors">
              <type.icon className="w-4 h-4" />
              <span className="text-xs font-medium">{type.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ============================================
// Feature Card
// ============================================
function FeatureCard({ icon: Icon, title, amharic, description }: { icon: React.ElementType; title: string; amharic: string; description: string }) {
  return (
    <div className="bg-card p-5 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-border hover:shadow-[0_16px_30px_rgb(0,0,0,0.06)] hover:-translate-y-1 transition-all duration-300">
      <div className="w-10 h-10 bg-brand-50 dark:bg-brand-900/20 rounded-lg flex items-center justify-center mb-3">
        <Icon className="w-5 h-5 text-primary" />
      </div>
      <h3 className="font-semibold text-base text-foreground mb-0.5">{title}</h3>
      <p className="text-xs font-medium text-primary mb-2">{amharic}</p>
      <p className="text-muted-foreground leading-relaxed text-sm">{description}</p>
    </div>
  )
}

// ============================================
// Features Section
// ============================================
function FeaturesSection() {
  const features = [
    { icon: Package, title: 'Inventory Tracking', amharic: 'ክምችት ክትትል', description: 'Know exactly what\'s in stock. Get low-stock alerts before you run out.' },
    { icon: ShoppingCart, title: 'Record Sales', amharic: 'ሽያጮችን መዝግቡ', description: 'Log every sale in seconds — cash, Telebirr, or bank transfer.' },
    { icon: TrendingUp, title: 'See Your Profit', amharic: 'ትርፍዎን ይወቁ', description: 'Automatic profit calculation per product and per day.' },
    { icon: CreditCard, title: 'Debt Tracking', amharic: 'ዕዳ ክትትል', description: 'Track who owes you and who you owe. Never lose track of credits.' },
    { icon: BarChart3, title: 'Daily Reports', amharic: 'ዕለታዊ ሪፖርቶች', description: 'Clear charts: sales trends, best sellers, and revenue at a glance.' },
    { icon: Bot, title: 'AI Assistant', amharic: 'AI ረዳት', description: 'Ask business questions and get AI-powered insights and recommendations.' },
  ]

  return (
    <section id="features" className="py-16 md:py-20 px-5 bg-background">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12 max-w-2xl mx-auto">
          <h2 className="text-xl sm:text-2xl font-semibold tabular-nums text-foreground tracking-tight mb-4 px-4">Complete control, beautifully simple.</h2>
          <p className="text-base sm:text-lg text-muted-foreground px-6">All the powerful tools you need to run your business gracefully.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map(feature => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </div>
    </section>
  )
}

// ============================================
// Business Types Section
// ============================================
function BusinessTypesSection() {
  const types = [
    { emoji: '📱', name: 'Phone Shops', amharic: 'ስልክ ሱቆች' },
    { emoji: '🛒', name: 'Mini Markets', amharic: 'ሚኒ ማርኬቶች' },
    { emoji: '💊', name: 'Pharmacies', amharic: 'ፋርማሲዎች' },
    { emoji: '👗', name: 'Clothing Stores', amharic: 'የልብስ ሱቆች' },
    { emoji: '🔌', name: 'Electronics', amharic: 'ኤሌክትሮኒክስ' },
    { emoji: '💈', name: 'Barbershops', amharic: 'ባርበር' },
    { emoji: '💄', name: 'Beauty Salons', amharic: 'ውበት ሳሎን' },
    { emoji: '🔨', name: 'Hardware', amharic: 'ሃርድዌር ሱቆች' },
    { emoji: '🏪', name: 'Any Business', amharic: 'ማንኛውም ስራ' },
  ]

  return (
    <section id="business-types" className="py-16 md:py-20 px-5 bg-muted/50">
      <div className="max-w-5xl mx-auto text-center">
        <div className="mb-10 sm:mb-12">
          <h2 className="text-xl sm:text-2xl font-semibold tabular-nums text-foreground tracking-tight mb-4 px-4">Fits any business</h2>
          <p className="font-medium text-muted-foreground tracking-wide text-base">ለሁሉም ዓይነት ስራ ተስማሚ</p>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          {types.map(type => (
            <div
              key={type.name}
              className="bg-card px-5 py-4 rounded-xl flex items-center gap-3 shadow-sm hover:shadow-[0_8px_20px_rgb(0,0,0,0.06)] hover:-translate-y-0.5 transition ring-1 ring-border/50 w-full sm:w-auto"
            >
              <div className="text-2xl">{type.emoji}</div>
              <div className="text-left">
                <div className="font-semibold text-foreground text-sm">{type.name}</div>
                <div className="text-primary text-xs font-medium">{type.amharic}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ============================================
// Testimonials Section
// ============================================
const testimonialsData = [
  {
    text: "Before this I used a notebook. Now I know my profit every day without calculating.",
    image: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=80&h=80&fit=crop&crop=face",
    name: "Abebe T.",
    role: "Phone Shop Owner",
  },
  {
    text: "The low stock alert saved me twice already. Very useful for managing my inventory.",
    image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=face",
    name: "Tigist M.",
    role: "Mini Market Manager",
  },
  {
    text: "The debt tracking feature is a lifesaver. I never forget who owes me anymore.",
    image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=face",
    name: "Dawit A.",
    role: "Electronics Store",
  },
  {
    text: "Finally an inventory app that works for Ethiopian businesses. The Amharic support is perfect.",
    image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop&crop=face",
    name: "Hana K.",
    role: "Pharmacy Owner",
  },
  {
    text: "I can track all my sales and expenses in one place. My accountant loves it too.",
    image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&crop=face",
    name: "Yonas B.",
    role: "Clothing Retailer",
  },
  {
    text: "The barcode scanning feature makes checkout so fast. Customers notice the difference.",
    image: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=80&h=80&fit=crop&crop=face",
    name: "Selam G.",
    role: "Supermarket Manager",
  },
  {
    text: "We switched from spreadsheets and it saved us hours every week. Best decision we made.",
    image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=face",
    name: "Fikadu S.",
    role: "Hardware Store Owner",
  },
  {
    text: "The daily profit report gives me peace of mind. I always know where my business stands.",
    image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&h=80&fit=crop&crop=face",
    name: "Meron T.",
    role: "Café Owner",
  },
  {
    text: "Managing multiple product categories used to be a nightmare. Now it takes seconds.",
    image: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=80&h=80&fit=crop&crop=face",
    name: "Biniam R.",
    role: "General Store",
  },
]

const firstColumn = testimonialsData.slice(0, 3)
const secondColumn = testimonialsData.slice(3, 6)
const thirdColumn = testimonialsData.slice(6, 9)

function TestimonialsSection() {
  return (
    <section className="py-16 md:py-20 bg-background relative">
      <div className="max-w-6xl mx-auto px-5">
        <div className="flex flex-col items-center justify-center max-w-[540px] mx-auto mb-10">
          <div className="inline-flex items-center gap-2 bg-card text-muted-foreground px-4 py-2 rounded-full text-sm mb-6 shadow-sm border border-border/50">
            <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />
            <span className="opacity-90">Testimonials</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight text-center">
            Loved by business owners
          </h2>
          <p className="text-center mt-3 text-muted-foreground">
            Join 500+ merchants modernizing with InvenSync.
          </p>
        </div>

        <div className="flex justify-center gap-6 [mask-image:linear-gradient(to_bottom,transparent,black_25%,black_75%,transparent)] max-h-[740px] overflow-hidden">
          <TestimonialsColumn testimonials={firstColumn} duration={15} />
          <TestimonialsColumn testimonials={secondColumn} className="hidden md:block" duration={19} />
          <TestimonialsColumn testimonials={thirdColumn} className="hidden lg:block" duration={17} />
        </div>
      </div>
    </section>
  )
}

// ============================================
// FAQ Section
// ============================================
function FAQSection() {
  const faqs = [
    {
      question: 'What happens after the 14-day trial?',
      answer: 'Your account stays active with limited features. Subscribe to unlock everything.',
    },
    {
      question: 'Is there a setup fee?',
      answer: 'No. Sign up, add your products, and start recording sales in under 5 minutes.',
    },
    {
      question: 'Can I cancel anytime?',
      answer: 'Yes, cancel anytime with no penalties. Your data is always yours.',
    },
    {
      question: 'Do I need internet to use InvenSync?',
      answer: 'InvenSync works offline too. Your data syncs when you\'re back online.',
    },
  ]

  return (
    <section className="py-16 md:py-20 px-5 bg-muted/50">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-xl sm:text-2xl font-semibold tabular-nums text-foreground tracking-tight mb-4">Frequently asked questions</h2>
          <p className="text-base text-muted-foreground">Everything you need to know about InvenSync.</p>
        </div>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`faq-${index}`} className="border-border">
              <AccordionTrigger className="text-foreground font-semibold hover:no-underline hover:text-primary transition-colors">
                {faq.question}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}

// ============================================
// Pricing Section
// ============================================
const pricingPlans = [
  {
    name: 'STARTER',
    price: '150',
    yearlyPrice: '120',
    period: 'month',
    features: [
      'Up to 500 products',
      'Basic inventory tracking',
      'Sales recording',
      'Daily reports',
      'Low stock alerts',
      'Community support',
    ],
    description: 'Perfect for small shops getting started',
    buttonText: 'Start Free Trial',
    href: '#register',
    isPopular: false,
  },
  {
    name: 'PROFESSIONAL',
    price: '200',
    yearlyPrice: '160',
    period: 'month',
    features: [
      'Unlimited products',
      'AI-powered insights & assistant',
      'Debt & credit tracking',
      'Advanced reports & analytics',
      'Multi-user access',
      'Priority support',
      'Barcode scanning',
    ],
    description: 'Ideal for growing businesses',
    buttonText: 'Get Started',
    href: '#register',
    isPopular: true,
  },
  {
    name: 'ENTERPRISE',
    price: '300',
    yearlyPrice: '240',
    period: 'month',
    features: [
      'Everything in Professional',
      'Multiple business locations',
      'Dedicated account manager',
      'Custom integrations & API',
      'Advanced security & backups',
      'Custom reports',
      'SLA agreement',
      'Telebirr & bank integration',
    ],
    description: 'For large organizations with multiple locations',
    buttonText: 'Contact Sales',
    href: '#register',
    isPopular: false,
  },
]

function PricingSection() {
  return (
    <section id="pricing" className="py-16 md:py-20 bg-background">
      <Pricing
        plans={pricingPlans}
        title="Simple, Transparent Pricing"
        description="Choose the plan that works for you\nAll plans include access to our platform, inventory tools, and dedicated support."
      />
    </section>
  )
}

// ============================================
// Footer
// ============================================
function LandingFooter({ onLogin, onRegister }: { onLogin: () => void; onRegister: () => void }) {
  return (
    <footer className="bg-card text-muted-foreground py-12 md:py-16 px-5 border-t border-border" role="contentinfo">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                <Store className="w-5 h-5 text-primary" />
              </div>
              <span className="font-semibold text-foreground text-lg tracking-tight">InvenSync</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">Made in Ethiopia 🇪🇹<br />For Local Businesses</p>
          </div>

          {/* Product */}
          <div>
            <h3 className="font-semibold text-foreground text-sm mb-3">Product</h3>
            <ul className="space-y-2">
              <li><a href="#features" className="text-sm hover:text-foreground transition-colors">Features</a></li>
              <li><a href="#pricing" className="text-sm hover:text-foreground transition-colors">Pricing</a></li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="font-semibold text-foreground text-sm mb-3">Company</h3>
            <ul className="space-y-2">
              <li><a href="#" className="text-sm hover:text-foreground transition-colors">About</a></li>
              <li><a href="#" className="text-sm hover:text-foreground transition-colors">Contact</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold text-foreground text-sm mb-3">Legal</h3>
            <ul className="space-y-2">
              <li><a href="#" className="text-sm hover:text-foreground transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="text-sm hover:text-foreground transition-colors">Terms of Service</a></li>
            </ul>
          </div>

          {/* Social */}
          <div>
            <h3 className="font-semibold text-foreground text-sm mb-3">Connect</h3>
            <ul className="space-y-2">
              <li><a href="#" className="text-sm hover:text-foreground transition-colors inline-flex items-center gap-1.5" aria-label="Follow on X (Twitter)">X (Twitter)</a></li>
              <li><a href="#" className="text-sm hover:text-foreground transition-colors inline-flex items-center gap-1.5" aria-label="Join Telegram group">Telegram</a></li>
            </ul>
          </div>
        </div>

        <div className="pt-6 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} InvenSync. All rights reserved.</p>
          <div className="flex gap-6 font-semibold text-sm">
            <button onClick={onLogin} className="hover:text-foreground transition-colors">Login</button>
            <button onClick={onRegister} className="text-primary hover:text-primary/80 transition-colors">Get Started</button>
          </div>
        </div>
      </div>
    </footer>
  )
}

// ============================================
// Main Landing Page
// ============================================
export function LandingPage({ onLogin, onRegister }: { onLogin: () => void; onRegister: () => void }) {
  return (
    <div className="min-h-screen bg-muted/50 text-foreground selection:bg-primary selection:text-white overflow-x-hidden transition-colors duration-300">
      {/* Skip-to-content for landing page */}
      <a href="#landing-content" className="skip-to-content">
        Skip to main content
      </a>
      <LandingNavbar onLogin={onLogin} onRegister={onRegister} />
      <div id="landing-content">
        <HeroSection onRegister={onRegister} />
        <StatsSection />
        <TrustedBySection />
        <FeaturesSection />
        <BusinessTypesSection />
        <TestimonialsSection />
        <FAQSection />
        <PricingSection />
      </div>
      <LandingFooter onLogin={onLogin} onRegister={onRegister} />
    </div>
  )
}
