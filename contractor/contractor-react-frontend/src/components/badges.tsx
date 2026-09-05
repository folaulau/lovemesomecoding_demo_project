import { PROJECT_STATUS_META, QUOTE_STATUS_META } from '../types/domain'
import type { ProjectStatus, QuoteStatus } from '../types/domain'
import { Badge } from './ui'

/**
 * Status badges, driven by the lookup tables in `types/domain.ts`.
 *
 * The point of centralising these is consistency: four screens render a project status and they
 * must agree on both the wording and the colour, or the same project looks like two different
 * things depending on where you saw it.
 */

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const meta = PROJECT_STATUS_META[status]
  return <Badge className={meta.className}>{meta.label}</Badge>
}

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  const meta = QUOTE_STATUS_META[status]
  return <Badge className={meta.className}>{meta.label}</Badge>
}
