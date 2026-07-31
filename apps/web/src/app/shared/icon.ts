import { Component, computed, input } from '@angular/core';

export type IconName =
  | 'mic'
  | 'mic-off'
  | 'video'
  | 'video-off'
  | 'screen-share'
  | 'chat'
  | 'hangup'
  | 'users'
  | 'send'
  | 'shield';

/** 24×24 stroke paths, drawn on a shared grid so weights stay consistent. */
const PATHS: Record<IconName, string> = {
  mic: 'M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM19 11a7 7 0 0 1-14 0M12 18v3M8.5 21h7',
  'mic-off':
    'M9 9v2a3 3 0 0 0 4.6 2.5M15 10.5V6a3 3 0 0 0-5.9-.7M19 11a7 7 0 0 1-1.1 3.8M5 11a7 7 0 0 0 10.3 6.2M12 18v3M8.5 21h7M3.5 3.5l17 17',
  video:
    'M15.5 10.5l5.5-3.2v9.4l-5.5-3.2M4.5 6h9a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z',
  'video-off':
    'M15.5 10.5l5.5-3.2v9.4l-3.2-1.9M13.5 18h-9a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h1.5M10 6h3.5a2 2 0 0 1 2 2v3.5M3.5 3.5l17 17',
  'screen-share':
    'M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM9 20h6M12 16v4M12 12.5V7M9.5 9.5L12 7l2.5 2.5',
  chat: 'M21 11.5a7.5 7.5 0 0 1-10.9 6.7L4 20l1.4-4.3A7.5 7.5 0 1 1 21 11.5zM9 10h6M9 13.5h4',
  hangup:
    'M3.5 13.2c4.7-4.7 12.3-4.7 17 0 .9.9.5 1.9-.3 2.4l-2 1.2c-.7.4-1.5.3-2-.3l-1.3-1.6c-.3-.4-.4-.9-.2-1.4l.3-.9a9 9 0 0 0-5.9 0l.3.9c.2.5.1 1-.2 1.4l-1.3 1.6c-.5.6-1.3.7-2 .3l-2-1.2c-.8-.5-1.2-1.5-.3-2.4z',
  users:
    'M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20M10 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM20 20v-1.5a3.5 3.5 0 0 0-2.6-3.4M15.5 4.7a3.5 3.5 0 0 1 0 6.6',
  send: 'M20 4L3 11l7 2.5L12.5 21z',
  shield: 'M12 3l7 3v6c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6zM9.5 12.2l1.8 1.8 3.4-3.6',
};

@Component({
  selector: 'app-icon',
  template: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      [attr.stroke-width]="strokeWidth()"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path [attr.d]="d()" />
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      line-height: 0;
    }
    svg {
      width: var(--icon-size, 22px);
      height: var(--icon-size, 22px);
    }
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly strokeWidth = input(1.7);
  protected readonly d = computed(() => PATHS[this.name()]);
}
