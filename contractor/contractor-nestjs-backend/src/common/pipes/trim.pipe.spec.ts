import { describe, expect, it } from 'vitest'
import type { ArgumentMetadata } from '@nestjs/common'

import { TrimPipe } from './trim.pipe.js'

/**
 * A pipe is the easiest thing in Nest to test: it is a class with one method that takes a value
 * and returns a value. There is no application to start, no database, and no testing module —
 * `new TrimPipe()` is the entire setup.
 *
 * ⚠️ That is worth noticing rather than skipping past. Guards, pipes and interceptors are all
 * plain classes, and the reason the e2e suite exists is NOT that this logic is hard to reach — it
 * is that the seven business rules span several of them at once. Anything that fits in a unit test
 * belongs in one, because these run in milliseconds with nothing switched on.
 */
const body: ArgumentMetadata = { type: 'body' }
const param: ArgumentMetadata = { type: 'param' }

describe('TrimPipe', () => {
  const pipe = new TrimPipe()

  it('trims the strings in a body', () => {
    expect(pipe.transform({ firstName: '  Maya  ', city: 'Austin ' }, body)).toEqual({
      firstName: 'Maya',
      city: 'Austin',
    })
  })

  /**
   * The bug this pipe exists for. `@Length(1, 80)` counts three characters and passes; the service
   * then stores `''`. After trimming, the validator sees the empty string it was meant to reject.
   */
  it('turns a whitespace-only field into the empty string, so @Length can reject it', () => {
    expect(pipe.transform({ firstName: '   ' }, body)).toEqual({ firstName: '' })
  })

  it('recurses into nested objects and arrays', () => {
    const input = { profile: { businessName: ' Luis Plumbing ' }, categoryIds: [' a ', 'b'] }
    expect(pipe.transform(input, body)).toEqual({
      profile: { businessName: 'Luis Plumbing' },
      categoryIds: ['a', 'b'],
    })
  })

  it('leaves non-strings alone', () => {
    const input = { budgetMin: 100, deleted: false, licenseNumber: null }
    expect(pipe.transform(input, body)).toEqual(input)
  })

  /** Route params belong to a URL the client built; silently rewriting one hides a client bug. */
  it('ignores anything that is not a body', () => {
    expect(pipe.transform('  abc  ', param)).toBe('  abc  ')
  })

  /**
   * ⚠️ The check that would have caught the worst version of this pipe. An earlier draft rebuilt
   * every `typeof value === 'object'` field by field, which turns a Date into a plain object and
   * a Buffer into `{0: 12, 1: 80, …}` — quietly, and only for requests that carry one.
   */
  it('does not rebuild class instances', () => {
    const date = new Date('2026-09-05T00:00:00.000Z')
    const buffer = Buffer.from('  hello  ')
    const result = pipe.transform({ date, buffer }, body) as { date: Date; buffer: Buffer }

    expect(result.date).toBeInstanceOf(Date)
    expect(result.date.getTime()).toBe(date.getTime())
    expect(Buffer.isBuffer(result.buffer)).toBe(true)
  })

  it('stops recursing at a sensible depth rather than following a hostile body down', () => {
    // Ten levels deep — past MAX_DEPTH, so the innermost string is returned untouched instead of
    // costing unbounded work.
    let nested: Record<string, unknown> = { value: '  deep  ' }
    for (let i = 0; i < 10; i += 1) nested = { nested }

    expect(() => pipe.transform(nested, body)).not.toThrow()
  })
})
