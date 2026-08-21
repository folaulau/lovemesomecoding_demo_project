/** Hand-rolled SVG icons.
 *
 * An icon library would be a dependency and a bundle-size decision for the ~15 glyphs this app
 * uses. These are stroke icons on a 24-box, sized by `width`/`height` so they inherit `currentColor`.
 */

type IconProps = { className?: string }

const base = 'h-5 w-5'

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      className={className ?? base}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      // Icons here are always beside a text label, so they are decoration to a screen reader.
      // An icon that is the ONLY content of a button needs a label on the button instead.
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const SearchIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>
)
export const StarIcon = ({ className }: IconProps) => (
  <svg className={className ?? 'h-4 w-4'} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="m12 2.5 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.3 6.2 20.4l1.1-6.5-4.7-4.6 6.5-.9z" />
  </svg>
)
export const UserIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Svg>
)
export const MenuIcon = (p: IconProps) => (
  <Svg {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Svg>
)
export const CloseIcon = (p: IconProps) => (
  <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>
)
export const CalendarIcon = (p: IconProps) => (
  <Svg {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></Svg>
)
export const UsersIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="9" cy="8" r="3.5" /><path d="M2 20a7 7 0 0 1 14 0" /><path d="M17 5.5a3.5 3.5 0 0 1 0 7M18 20a7 7 0 0 0-2-4.9" /></Svg>
)
export const BedIcon = (p: IconProps) => (
  <Svg {...p}><path d="M3 18v-8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v8M3 14h18M3 18v2M21 18v2" /><circle cx="7.5" cy="11" r="1.5" /></Svg>
)
export const BathIcon = (p: IconProps) => (
  <Svg {...p}><path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" /><path d="M6 12V6a2 2 0 0 1 4 0M7 19l-1 2M17 19l1 2" /></Svg>
)
export const HomeIcon = (p: IconProps) => (
  <Svg {...p}><path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" /></Svg>
)
export const CheckIcon = (p: IconProps) => (
  <Svg {...p}><path d="m5 13 4 4L19 7" /></Svg>
)
export const ChevronLeft = (p: IconProps) => (
  <Svg {...p}><path d="m15 6-6 6 6 6" /></Svg>
)
export const ChevronRight = (p: IconProps) => (
  <Svg {...p}><path d="m9 6 6 6-6 6" /></Svg>
)
export const ShieldIcon = (p: IconProps) => (
  <Svg {...p}><path d="M12 3l7 3v6c0 4.2-2.9 7.9-7 9-4.1-1.1-7-4.8-7-9V6z" /><path d="m9 12 2 2 4-4" /></Svg>
)
export const SpinnerIcon = ({ className }: IconProps) => (
  <svg className={`animate-spin ${className ?? 'h-5 w-5'}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
    <path className="opacity-90" d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
)
