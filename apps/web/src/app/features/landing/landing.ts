import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HlmButton } from '@org/ui-components/button';
import { HlmCardImports } from '@org/ui-components/card';
import { AuthService } from '../../core/auth.service';
import { Logo } from '../../shared/logo';

@Component({
  selector: 'app-landing',
  imports: [RouterLink, Logo, HlmButton, HlmCardImports],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class Landing {
  protected readonly auth = inject(AuthService);

  /** Persian calendar year, so the footer never goes stale. */
  protected readonly year = new Intl.DateTimeFormat('fa-IR', {
    year: 'numeric',
  }).format(new Date());
}
