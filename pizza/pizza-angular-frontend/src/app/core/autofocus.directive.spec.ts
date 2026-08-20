import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Autofocus } from './autofocus.directive';

/* ==========================================================================
 * ANGULAR CONCEPT: testing a directive through a host component
 *
 * A directive has no template of its own, so there is nothing to instantiate directly. The standard
 * technique is a throwaway host component declared in the spec file that uses the directive the way
 * a real template would — which also means the test exercises the SELECTOR, not just the class.
 * A directive that works but whose selector is misspelled still passes a test that news up the
 * class by hand; it does not pass this one.
 *
 * `await fixture.whenStable()` is load-bearing. The directive focuses inside `afterNextRender`,
 * which by design runs after the DOM has been written — asserting straight after
 * `createComponent` would check before it has happened and fail for the wrong reason.
 * ========================================================================== */

@Component({
  imports: [Autofocus],
  template: `
    <input id="plain" />
    <input id="focused" appAutofocus />
  `,
})
class EnabledHost {}

@Component({
  imports: [Autofocus],
  template: `
    <input id="plain" />
    <input id="disabled" [appAutofocus]="false" />
  `,
})
class DisabledHost {}

describe('Autofocus', () => {
  it('focuses its host element once the DOM exists', async () => {
    const fixture = TestBed.createComponent(EnabledHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const input: HTMLInputElement = fixture.nativeElement.querySelector('#focused');
    expect(document.activeElement).toBe(input);
  });

  it('does nothing when switched off', async () => {
    const fixture = TestBed.createComponent(DisabledHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const input: HTMLInputElement = fixture.nativeElement.querySelector('#disabled');
    // The `booleanAttribute` transform has to turn `false` into a real boolean for this to hold.
    // Without it the bound value is truthy and the field steals focus anyway.
    expect(document.activeElement).not.toBe(input);
  });
});
