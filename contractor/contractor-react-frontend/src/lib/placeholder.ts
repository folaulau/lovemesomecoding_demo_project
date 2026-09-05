/**
 * Placeholder imagery, generated rather than fetched.
 *
 * Every demo project reaches the point where it needs a few dozen photos. The usual answers are a
 * hotlinked `images.unsplash.com` URL or a `picsum.photos` redirect, and both have the same two
 * problems: the app stops working on a plane, and the images rot the day someone deletes the file
 * upstream. These are SVGs built in the browser and handed over as `data:` URIs, so they cost one
 * string, always render, and never 404.
 *
 * Real uploaded portfolio photos replace these — the backend serves those from `/uploads`. This is
 * only for seeded and mocked rows that have no file behind them.
 */

/** Deterministic 32-bit hash, so the same seed always picks the same colour. `Math.random()` here
 *  would repaint every avatar on every re-render, which reads as a flicker rather than a design. */
function hash(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

// Muted, desaturated tones — a photo stand-in should recede behind the interface, not compete with
// the brand colour for attention.
const SWATCHES = [
  ['#0f766e', '#134e4a'],
  ['#475569', '#1e293b'],
  ['#b45309', '#78350f'],
  ['#1d4ed8', '#1e3a8a'],
  ['#4d7c0f', '#365314'],
  ['#9f1239', '#4c0519'],
] as const

function svgToDataUri(svg: string): string {
  // `encodeURIComponent` rather than `btoa`: the SVG contains non-ASCII characters (the emoji on
  // category tiles) and `btoa` throws an InvalidCharacterError on anything above U+00FF.
  return `data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}`
}

/** A wide 3:2 stand-in for a portfolio photo or a project hero image. */
export function placeholderPhoto(seed: string, label?: string): string {
  const [from, to] = SWATCHES[hash(seed) % SWATCHES.length]
  const id = `g${hash(seed) % 100000}`
  return svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400">
      <defs>
        <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${from}"/>
          <stop offset="100%" stop-color="${to}"/>
        </linearGradient>
      </defs>
      <rect width="600" height="400" fill="url(#${id})"/>
      <g fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="2">
        <path d="M0 300 L200 180 L360 280 L600 140"/>
        <path d="M0 360 L240 240 L420 330 L600 220"/>
      </g>
      ${
        label
          ? `<text x="300" y="212" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif"
                   font-size="30" font-weight="600" fill="rgba(255,255,255,0.92)">${escapeXml(label)}</text>`
          : ''
      }
    </svg>
  `)
}

/** A square monogram avatar — initials on a colour picked from the person's own name. */
export function placeholderAvatar(name: string): string {
  const [from, to] = SWATCHES[hash(name) % SWATCHES.length]
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase()
  const id = `a${hash(name) % 100000}`
  return svgToDataUri(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
      <defs>
        <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${from}"/>
          <stop offset="100%" stop-color="${to}"/>
        </linearGradient>
      </defs>
      <rect width="120" height="120" rx="60" fill="url(#${id})"/>
      <text x="60" y="76" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif"
            font-size="46" font-weight="600" fill="#fff">${escapeXml(initials)}</text>
    </svg>
  `)
}

/**
 * ⚠️ Not decoration. These strings are interpolated into markup that the browser then parses as a
 * document, so a business name containing `&` produces an SVG that fails to parse and an image
 * that silently does not render — and one containing `<` is a genuine injection point.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
