import { Component, input } from '@angular/core';

/**
 * The روم‌کیت lockup, rendered from the supplied brand artwork.
 *
 * The source file is a stacked lockup (mark above wordmark). It is split into
 * `logo-mark.png` and `logo-wordmark.png` in `public/` so the same artwork can
 * also sit horizontally in tight bars — see `tools/` note in AGENTS.md for how
 * the pieces were cut.
 */
@Component({
  selector: 'app-logo',
  template: `
    <span class="logo" [class.stacked]="stacked()" [style.--mark-size.px]="size()">
      <img
        class="mark"
        src="logo-mark.png"
        [attr.alt]="showWord() ? '' : 'روم‌کیت'"
        [attr.aria-hidden]="showWord() ? 'true' : null"
        decoding="async"
      />
      @if (showWord()) {
        <img class="word" src="logo-wordmark.png" alt="روم‌کیت" decoding="async" />
      }
    </span>
  `,
  styles: `
    .logo {
      display: inline-flex;
      align-items: center;
      gap: 0.34em;
      font-size: var(--mark-size, 28px);
      line-height: 0;
    }
    .logo.stacked {
      flex-direction: column;
      gap: 0.5em;
    }
    .mark {
      width: var(--mark-size, 28px);
      height: auto;
      flex: none;
      display: block;
    }
    /* Sized off the mark so the two pieces stay in proportion at every size. */
    .word {
      height: calc(var(--mark-size, 28px) * 0.5);
      width: auto;
      flex: none;
      display: block;
    }
    .logo.stacked .word {
      height: calc(var(--mark-size, 28px) * 0.42);
    }
  `,
})
export class Logo {
  readonly size = input(28);
  readonly showWord = input(true);
  /** Mark above wordmark, as in the source artwork. */
  readonly stacked = input(false);
}
