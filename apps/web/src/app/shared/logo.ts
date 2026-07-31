import { Component, input } from '@angular/core';

/**
 * The روم‌کیت lockup: two overlapping rounded squares (a solid indigo→blue
 * panel with a translucent cyan panel laid over it) plus the wordmark.
 *
 * Rebuilt as inline SVG rather than a raster asset so it stays sharp at any
 * size and inherits the page's text colour for the wordmark.
 */
@Component({
  selector: 'app-logo',
  template: `
    <span class="logo" [style.--mark-size.px]="size()">
      <svg class="mark" viewBox="0 0 120 120" role="img" aria-label="روم‌کیت">
        <defs>
          <linearGradient [attr.id]="backId" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#5b3ff0" />
            <stop offset="0.55" stop-color="#3d7ef2" />
            <stop offset="1" stop-color="#1fb6f5" />
          </linearGradient>
          <linearGradient [attr.id]="frontId" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#3fd4ff" />
            <stop offset="1" stop-color="#b7f6ff" />
          </linearGradient>
        </defs>

        <rect x="6" y="2" width="78" height="78" rx="23" [attr.fill]="backUrl" />
        <rect
          x="36"
          y="32"
          width="78"
          height="78"
          rx="23"
          [attr.fill]="frontUrl"
          fill-opacity="0.78"
          stroke="#ffffff"
          stroke-opacity="0.35"
        />
      </svg>

      @if (showWord()) {
        <span class="word">روم‌کیت</span>
      }
    </span>
  `,
  styles: `
    .logo {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      line-height: 1;
    }
    .mark {
      width: var(--mark-size, 28px);
      height: var(--mark-size, 28px);
      flex: none;
      display: block;
    }
    .word {
      font-weight: 800;
      font-size: calc(var(--mark-size, 28px) * 0.72);
      letter-spacing: normal;
      color: inherit;
    }
  `,
})
export class Logo {
  readonly size = input(28);
  readonly showWord = input(true);

  /** Unique gradient ids — several logos can share one page. */
  private readonly uid = Math.random().toString(36).slice(2, 8);
  protected readonly backId = `lk-back-${this.uid}`;
  protected readonly frontId = `lk-front-${this.uid}`;
  protected readonly backUrl = `url(#${this.backId})`;
  protected readonly frontUrl = `url(#${this.frontId})`;
}
