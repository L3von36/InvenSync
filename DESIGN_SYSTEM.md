# InvenSync Design System

The visual language for every InvenSync surface. Tokens live in
`src/app/globals.css`, shared primitives in
`src/components/shared/design-system.tsx`. If you're building UI and this
document doesn't answer your question, extend it — don't invent a one-off.

## Brand essence

InvenSync is a tool shopkeepers trust with their livelihood. The UI should feel
**warm, confident, and unambiguous**: warm because of the orange brand and soft
neutrals, confident because numbers are large and never truncated into
ambiguity, unambiguous because every color means the same thing on every
screen.

## Color

### Brand

The brand is **orange**. The full ramp is available as `brand-50` … `brand-900`
(Tailwind classes like `bg-brand-500`), anchored at `brand-500 = #f97316`.
`--primary` is the oklch equivalent and is what components should normally use
(`bg-primary`, `text-primary`) so dark mode stays correct.

The **brand gradient** (`--gradient-brand`, class `.ds-brand-gradient`) is the
signature: `#fb923c → #f97316 → #ea580c` at 135°. Use it for:

- Page-header icon tiles (via `PageHeader`)
- The logo tile on auth/loading screens
- At most one hero accent per screen

Never use it for body text, table rows, or large background washes.
`.ds-brand-text-gradient` exists for a single headline at most per screen.

### Semantic tones

**Color carries meaning, never decoration.** Every KPI, badge, and status is
**neutral by default**; color must be earned. The mapping is enforced by the
`tone` prop on `StatCard` (default: `neutral`):

| Tone      | Meaning                            | Example metrics                    |
| --------- | ---------------------------------- | ---------------------------------- |
| `brand`   | THE primary metric — max 1/screen  | Period revenue, MRR                |
| `success` | Positive financial health          | Profit (when positive), growth     |
| `warning` | Needs attention soon               | Low stock, pending, expiring       |
| `danger`  | Needs attention now                | Out of stock, overdue debt, loss   |
| `neutral` | Everything else                    | Counts, totals, informational      |

`info` and `violet` are **retired** — they render as neutral. Sky-blue
"Total Products" told the user nothing.

Additional rules:

- **At most one `brand` card per screen.** It marks the single metric the
  page exists for.
- **Prefer conditional tones** for metrics that can flip meaning:
  `tone={netProfit >= 0 ? 'success' : 'danger'}`,
  `tone={debt > 0 ? 'danger' : 'neutral'}`.
- Navigation/quick-action tiles are neutral (color is for state, not links).
- Entity types (products vs. customers vs. suppliers) are distinguished by
  their **icon**, never by decorative colors.
- Semantic tints use the `/10` opacity form (`bg-amber-500/10`), not the
  `-100 dark:-900/30` pair.
- Warnings are **amber**, never orange — orange is the brand.

Rule of thumb: a dashboard should read like a calm gray page where the eye
goes straight to the one orange number and anything amber/red — because those
actually mean something. If everything is colorful, nothing is.

### Neutrals

Backgrounds, borders, and text come exclusively from the theme tokens
(`background`, `card`, `muted`, `border`, `foreground`, `muted-foreground`).
Never hardcode grays; the oklch neutrals carry a slight warm hue (60°) that
matches the brand.

## Typography

Inter, with the system stack as fallback (`--font-sans`).

| Role            | Classes                                     |
| --------------- | ------------------------------------------- |
| Page title      | `text-lg sm:text-xl lg:text-2xl font-semibold tracking-tight` (use `PageHeader` / `GreetingHeader`) |
| Section title   | `text-sm font-semibold` (use `SectionCard`) |
| KPI value       | `text-base sm:text-lg lg:text-xl xl:text-2xl font-semibold tabular-nums tracking-tight` (use `StatCard`) |
| Body            | `text-sm`                                   |
| Caption/context | `text-xs text-muted-foreground`             |

Type ramps up with the viewport — phones get the compact size, desktops the
full size. Never ship a single fixed size for headings or KPI values.

Numbers are the product: KPI values never wrap, never truncate, and always use
**`tabular-nums`** (fixed-width digits) so amounts align. Data tables get this
globally via `[data-slot='table'] { font-variant-numeric: tabular-nums }`.
Currency is always formatted through the shared formatters (`formatETB` /
currency context), never inline. Weights top out at `font-semibold` —
`font-bold` is not part of the scale.

## Spacing & layout

- Base unit is 4px (Tailwind scale). Dashboards use `space-y-4 sm:space-y-6`
  between sections, `gap-3 sm:gap-4` inside KPI grids, `gap-4 sm:gap-6`
  inside content grids (charts, lists). Cards themselves are responsive:
  the base `Card` uses `py-4 px-4 sm:py-6 sm:px-6` so every surface is
  denser on phones without per-page overrides.
- KPI grids: `grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4` (2-up on mobile,
  4-up on desktop). Never 1-up on mobile — shopkeepers scan pairs.
- Page content sits inside the shell's padding; pages don't add their own
  horizontal padding.

## Radius & elevation

- Radius comes from `--radius` (10px): cards `rounded-xl` (via Card), inputs
  and buttons `rounded-md`, icon tiles `rounded-lg`/`rounded-xl`, chips
  `rounded-full`.
- **Border OR shadow, never both.** Cards are flat at rest — a 1px border and
  no shadow. Interactive cards (`.ds-card-interactive`) gain a subtle shadow
  on hover only. Depth comes from borders and background contrast, not
  shadow stacking.

## Motion

- Micro-interactions: 150–200ms ease (`transition-colors`, elevation).
- Page transitions: `pageEnter` (300ms, 4px rise).
- Everything must respect `prefers-reduced-motion` (already handled globally).
- No motion on data itself (numbers don't bounce; `NumberFlow` count-ups are
  the one sanctioned exception).

## Components

Shared primitives in `src/components/shared/design-system.tsx`:

- **`PageHeader`** — every page starts with one: brand-gradient icon tile,
  title, optional badges (status chips), optional right-aligned actions, and
  the gradient hairline (`.ds-hairline`). Don't hand-roll `<h1>` headers.
- **`StatCard` / `StatCardSkeleton`** — the only way to render a KPI. Pass
  `tone` when the metric is a signal; omit it for neutral. The legacy
  `iconBgClass`/`iconTextClass` props are **ignored** (they render neutral) —
  per-page color overrides are what created the rainbow dashboards. Supports
  a `comparisonBadge` for period-over-period deltas.
- **`SectionCard`** — wrapper for charts/lists with a consistent header row.

Everything else composes shadcn/ui primitives (`components/ui/*`). Before
adding a new component, check whether a composition of existing ones works.

## Voice & content

- Titles are nouns ("Business Dashboard"), subtitles are one plain sentence.
- Empty states always offer the next action (see `EmptyState`).
- Offline/status chips use the same language everywhere: "Viewing cached
  data", "You are offline", "N pending changes".

## Accessibility

- Focus-visible outlines, skip-to-content, and reduced-motion are handled
  globally — don't override them.
- Icon tiles are decorative (`aria-hidden`); the text carries the meaning.
- Tone colors always pair with a label or icon — color is never the only
  signal (WCAG 1.4.1).
- Interactive rows need `cursor-pointer` and a hover surface
  (`hover:bg-muted/30`).
