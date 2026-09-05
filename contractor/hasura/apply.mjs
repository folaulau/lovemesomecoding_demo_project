/**
 * Pushes `metadata.mjs` into a running Hasura.
 *
 *   node hasura/apply.mjs           # apply
 *   node hasura/apply.mjs --check   # show what Hasura currently has, change nothing
 *
 * No dependencies and no Hasura CLI — Node 18+ has `fetch`, and the metadata API is one endpoint.
 * The CLI is the right tool on a real project (it does migrations and versioned metadata); here it
 * would be a binary to install before the demo runs.
 *
 * ⚠️ `replace_metadata` is a REPLACE, not a merge. Anything tracked in the console and not written
 * in metadata.mjs disappears when this runs. That is the intended behaviour — the file is the
 * source of truth, and a console click that survives a re-apply is a permission nobody reviewed.
 */

import { metadata } from './metadata.mjs'

const ENDPOINT = process.env.HASURA_ENDPOINT ?? 'http://localhost:8083'
// The admin secret bypasses every permission in metadata.mjs. It belongs in a script like this and
// in the console, and nowhere near a browser bundle.
const ADMIN_SECRET = process.env.HASURA_ADMIN_SECRET ?? 'contractor-admin-secret'

async function callMetadataApi(body) {
  const response = await fetch(`${ENDPOINT}/v1/metadata`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': ADMIN_SECRET,
    },
    body: JSON.stringify(body),
  })

  const text = await response.text()
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    // A non-JSON body here is nearly always an HTML error page from something that is not Hasura —
    // usually the wrong port. Saying so beats a JSON parse error.
    throw new Error(`${ENDPOINT} did not return JSON. Is Hasura running there?\n${text.slice(0, 300)}`)
  }

  if (!response.ok) {
    throw new Error(`Hasura rejected the request (${response.status}):\n${JSON.stringify(parsed, null, 2)}`)
  }
  return parsed
}

async function main() {
  const checkOnly = process.argv.includes('--check')

  if (checkOnly) {
    const current = await callMetadataApi({ type: 'export_metadata', args: {} })
    const tables = current.sources?.[0]?.tables ?? []
    console.log(`${tables.length} tables tracked:`)
    for (const table of tables) {
      const roles = (table.select_permissions ?? []).map((p) => p.role).join(', ') || 'none'
      console.log(`  ${table.table.name.padEnd(22)} select: ${roles}`)
    }
    return
  }

  console.log(`applying metadata to ${ENDPOINT} …`)
  await callMetadataApi({
    type: 'replace_metadata',
    args: {
      // ⚠️ `allow_inconsistent_metadata: false`. The default is to accept metadata that references
      // a table which does not exist and mark it "inconsistent" — so a typo'd column name applies
      // cleanly and the permission it belonged to is simply not enforced. Failing instead means a
      // mistake here is a failed script, not a silently missing rule.
      allow_inconsistent_metadata: false,
      metadata,
    },
  })

  const applied = await callMetadataApi({ type: 'export_metadata', args: {} })
  const tables = applied.sources?.[0]?.tables ?? []

  console.log(`\ntracked ${tables.length} tables:`)
  for (const table of tables) {
    const selects = table.select_permissions ?? []
    const writes =
      (table.insert_permissions?.length ?? 0) +
      (table.update_permissions?.length ?? 0) +
      (table.delete_permissions?.length ?? 0)

    // ⚠️ This assertion is the point of printing anything. Every write in this app goes through
    // NestJS; a write permission appearing here means someone opened a second path to the tables
    // that skips every business rule. It should never be anything but 0.
    const flag = writes > 0 ? `  ⚠️  ${writes} WRITE PERMISSIONS` : ''
    console.log(`  ${table.table.name.padEnd(22)} select: ${selects.map((p) => p.role).join(', ') || 'none'}${flag}`)
  }

  const totalWrites = tables.reduce(
    (sum, t) =>
      sum +
      (t.insert_permissions?.length ?? 0) +
      (t.update_permissions?.length ?? 0) +
      (t.delete_permissions?.length ?? 0),
    0,
  )

  if (totalWrites > 0) {
    console.error(`\n⚠️  ${totalWrites} write permissions are configured. Every write belongs in NestJS.`)
    process.exit(1)
  }

  console.log('\ndone — reads only, as intended.')
}

main().catch((error) => {
  console.error(`\n${error.message}`)
  // Non-zero, so a shell script or CI step that chains commands actually stops here.
  process.exit(1)
})
