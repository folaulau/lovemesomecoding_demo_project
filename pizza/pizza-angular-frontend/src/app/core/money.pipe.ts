import { Pipe, PipeTransform } from '@angular/core';
import { formatMoney } from './money';

/* ==========================================================================
 * ANGULAR CONCEPT: a pipe
 *
 * A pipe is a formatting function callable from a template: `{{ total | money }}`. React has no
 * equivalent because it does not need one — a template there is JavaScript, so `formatMoney(total)`
 * is already available. An Angular template is not JavaScript, so a function has to be either a
 * method on the component (repeated on every component that formats money) or a pipe (declared
 * once and imported where needed).
 *
 * `pure: true` is the default and matters: a pure pipe only re-runs when its INPUT changes, so it
 * is not called again on every change-detection pass. An impure pipe would be — the classic way to
 * make an Angular list slow.
 *
 * Angular ships a `CurrencyPipe` that does very nearly this. This one exists so both frontends
 * format money through the same `formatMoney` function, and cannot drift apart on rounding.
 * ========================================================================== */
@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return formatMoney(value ?? 0);
  }
}

/** SMALL -> "Small", PENDING_PAYMENT -> "Pending payment". Used for enum values from the API. */
export function humanise(value: string): string {
  const spaced = value.replace(/_/g, ' ').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** The same, as a pipe, for templates. */
@Pipe({ name: 'humanise' })
export class HumanisePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return value ? humanise(value) : '';
  }
}
