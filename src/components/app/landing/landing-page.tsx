'use client'

import { useState } from 'react'
import {
  Package,
  ShoppingCart,
  TrendingUp,
  BarChart3,
  ArrowRight,
  Store,
  Moon,
  Sun,
  Menu,
  X,
  Check,
  Quote,
  Star,
  Bot,
  CreditCard,
  ShoppingBag,
  Pill,
  Shirt,
  Cpu,
  Scissors,
  Wrench,
} from 'lucide-react'
import { useTheme } from 'next-themes'
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
  const { theme, setTheme } = useTheme()

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
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" aria-hidden="true" /> : <Moon className="w-5 h-5" aria-hidden="true" />}
          </button>
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
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" aria-hidden="true" /> : <Moon className="w-5 h-5" aria-hidden="true" />}
          </button>
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
          Everything you need <br className="hidden sm:block" />
          to{' '}
          <span className="text-primary relative inline-block">
            grow your business.
            <svg className="absolute w-full h-2 sm:h-3 -bottom-1 left-0 text-primary/30 -z-10" viewBox="0 0 100 10" preserveAspectRatio="none">
              <path d="M0 5 Q 50 10 100 5" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            </svg>
          </span>
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
          <div className="text-xl sm:text-2xl font-bold text-primary-foreground tracking-tight mb-1 group-hover:scale-105 transition-transform origin-center">&lt; 30s</div>
          <div className="text-xs sm:text-sm font-medium text-primary-foreground/70">To record a sale</div>
        </div>
        <div className="w-full text-center group">
          <div className="text-xl sm:text-2xl font-bold text-primary-foreground tracking-tight mb-1 group-hover:scale-105 transition-transform origin-center">AI</div>
          <div className="text-xs sm:text-sm font-medium text-primary-foreground/70">Powered insights</div>
        </div>
        <div className="w-full text-center group">
          <div className="text-xl sm:text-2xl font-bold text-primary-foreground tracking-tight mb-1 group-hover:scale-105 transition-transform origin-center">150 ETB</div>
          <div className="text-xs sm:text-sm font-medium text-primary-foreground/70">Monthly flat rate</div>
        </div>
        <div className="w-full text-center group">
          <div className="text-xl sm:text-2xl font-bold text-primary-foreground tracking-tight mb-1 group-hover:scale-105 transition-transform origin-center">14 Days</div>
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
          <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight mb-4 px-4">Complete control, beautifully simple.</h2>
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
          <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight mb-4 px-4">Fits any business</h2>
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
function TestimonialsSection() {
  const testimonials = [
    {
      quote: 'Before this I used a notebook. Now I know my profit every day without calculating.',
      name: 'Abebe T.',
      business: 'Phone Shop',
      initial: 'A',
    },
    {
      quote: 'The low stock alert saved me twice already. Very useful for 150 birr.',
      name: 'Tigist M.',
      business: 'Mini Market',
      initial: 'T',
    },
    {
      quote: 'The debt tracking feature is a lifesaver. I never forget who owes me anymore.',
      name: 'Dawit A.',
      business: 'Electronics',
      initial: 'D',
    },
  ]

  return (
    <section className="py-16 md:py-20 px-5 bg-background">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight mb-4 px-4">Loved by business owners</h2>
          <p className="text-base sm:text-lg text-muted-foreground px-6">Join 500+ merchants modernizing with InvenSync.</p>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {testimonials.map(testimonial => (
            <div key={testimonial.name} className="bg-muted/50 p-6 rounded-xl relative isolate">
              <div className="absolute top-6 right-6 opacity-10 text-primary">
                <Quote className="w-10 h-10" />
              </div>
              <div className="flex gap-0.5 mb-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <Star key={i} className="w-4 h-4 fill-primary text-primary" />
                ))}
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed mb-5 relative z-10">
                &ldquo;{testimonial.quote}&rdquo;
              </p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-muted rounded-full flex items-center justify-center font-semibold text-muted-foreground text-sm">
                  {testimonial.initial}
                </div>
                <div>
                  <div className="font-semibold text-foreground text-sm">{testimonial.name}</div>
                  <div className="text-muted-foreground text-xs">{testimonial.business}</div>
                </div>
              </div>
            </div>
          ))}
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
          <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight mb-4">Frequently asked questions</h2>
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
function PricingSection({ onRegister }: { onRegister: () => void }) {
  return (
    <section id="pricing" className="py-16 md:py-20 px-4 sm:px-5 bg-foreground relative isolate overflow-hidden">
      <div className="absolute inset-0 bg-primary blur-[200px] opacity-20 -z-10 rounded-full w-[120%] h-full max-w-4xl mx-auto" />

      <div className="max-w-sm mx-auto bg-card rounded-xl p-6 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.4)] border border-border">
        <div className="text-center mb-5">
          <h2 className="text-xl font-bold text-card-foreground mb-2">Simple, flat pricing</h2>
          <p className="text-muted-foreground font-medium text-sm">No hidden fees, cancel anytime.</p>
        </div>
        <div className="flex flex-col items-center justify-center mb-6">
          <div className="flex items-start gap-1">
            <span className="text-2xl sm:text-3xl font-bold text-card-foreground tracking-tighter">150</span>
            <div className="flex flex-col text-left mt-1 sm:mt-2">
              <span className="text-base sm:text-lg font-semibold text-primary">ETB</span>
            </div>
          </div>
          <span className="font-semibold text-muted-foreground mt-1 text-xs sm:text-sm">per month, per business</span>
        </div>
        <ul className="space-y-3 mb-6">
          {[
            'Unlimited products & records',
            'AI-powered insights & assistant',
            'Debt & credit tracking',
            'Daily automated reports',
            'Low stock alerts',
            'No transaction fees',
          ].map(feature => (
            <li key={feature} className="flex items-center gap-2.5 text-foreground text-sm">
              <div className="w-5 h-5 bg-brand-50 dark:bg-brand-900/20 rounded-full flex flex-shrink-0 items-center justify-center">
                <Check className="w-3.5 h-3.5 text-primary" />
              </div>
              {feature}
            </li>
          ))}
        </ul>
        <button
          onClick={onRegister}
          className="block w-full bg-primary dark:bg-primary text-primary-foreground font-semibold text-sm py-3 rounded-full shadow-[0_10px_20px_rgba(0,0,0,0.1)] hover:shadow-[0_15px_30px_rgba(0,0,0,0.15)] hover:-translate-y-1 transition-all text-center"
        >
          Start Free Trial
        </button>
        <div className="mt-4 text-center font-medium text-muted-foreground text-[13px]">Pay safely via Telebirr · No card required</div>
      </div>
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
        <PricingSection onRegister={onRegister} />
      </div>
      <LandingFooter onLogin={onLogin} onRegister={onRegister} />
    </div>
  )
}
