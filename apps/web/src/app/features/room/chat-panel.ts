import {
  Component,
  ElementRef,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RoomService } from '../../core/room.service';
import { FaNumber } from '../../shared/fa-number.pipe';
import { HlmButton } from '@org/ui-components/button';
import { HlmInput } from '@org/ui-components/input';
import { Icon } from '../../shared/icon';

@Component({
  selector: 'app-chat-panel',
  imports: [FormsModule, FaNumber, Icon, HlmButton, HlmInput],
  template: `
    <div class="log" #log>
      @if (rs.messages().length === 0) {
        <p class="empty">
          هنوز پیامی فرستاده نشده. پیام‌ها فقط تا پایان همین جلسه در دسترس‌اند.
        </p>
      }

      @for (m of rs.messages(); track m.id) {
        <div class="msg" [class.mine]="m.isLocal">
          @if (!m.isLocal) {
            <span class="who">{{ m.from }}</span>
          }
          <p class="body">{{ m.text }}</p>
          <span class="at">
            {{ m.at.getHours() | faNumber: 2 }}:{{ m.at.getMinutes() | faNumber: 2 }}
          </span>
        </div>
      }
    </div>

    <form class="composer" (submit)="$event.preventDefault(); send()">
      <input
        hlmInput
        type="text"
        placeholder="پیام بنویسید…"
        [ngModel]="draft()"
        (ngModelChange)="draft.set($event)"
        name="draft"
        autocomplete="off"
      />
      <button hlmBtn size="icon" type="submit" [disabled]="!draft().trim()" title="ارسال">
        <app-icon name="send" />
      </button>
    </form>
  `,
  styleUrl: './chat-panel.scss',
})
export class ChatPanel {
  protected readonly rs = inject(RoomService);
  protected readonly draft = signal('');

  private readonly logRef = viewChild.required<ElementRef<HTMLDivElement>>('log');

  constructor() {
    // Keep the newest message in view as the transcript grows.
    effect(() => {
      this.rs.messages();
      const el = this.logRef().nativeElement;
      queueMicrotask(() => (el.scrollTop = el.scrollHeight));
    });
  }

  protected async send(): Promise<void> {
    const text = this.draft().trim();
    if (!text) return;
    this.draft.set('');
    await this.rs.sendChat(text);
  }
}
