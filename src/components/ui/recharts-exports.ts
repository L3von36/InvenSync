/**
 * Shared Recharts Re-exports
 * 
 * Centralizes all recharts imports so the bundler creates a SINGLE shared chunk
 * instead of duplicating recharts across multiple lazy-loaded pages.
 * 
 * Before: 9 pages importing directly from 'recharts' → 3 duplicated 389KB chunks
 * After: 9 pages importing from this shared module → 1 shared 389KB chunk
 */

export {
  // Chart types
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  ComposedChart,
  Cell,

  // Axes & Grid
  XAxis,
  YAxis,
  CartesianGrid,

  // Overlays
  Tooltip,
  Legend,
  ResponsiveContainer,

  // Reference lines
  ReferenceLine,
} from 'recharts'
