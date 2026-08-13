import { Component, computed, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HlmButton, HlmCardImports } from '@org/ui';
import { tenantPortalUrl } from '../../core/tenant-portal-url';

const plans = {
  free: ['free', 'رایگان', '۰ تومان'],
  pro: ['pro', 'پرو', '۷٬۰۰۰٬۰۰۰ تومان ماهانه'],
  usage: ['usage', 'مصرفی', 'بر پایهٔ مصرف'],
} as const;
@Component({
  selector: 'app-checkout',
  imports: [RouterLink, HlmButton, HlmCardImports],
  templateUrl: './checkout.html',
  styleUrl: './pricing.scss',
})
export class Checkout {
  private readonly route = inject(ActivatedRoute);
  protected readonly tenantPortalUrl = tenantPortalUrl();
  protected readonly plan = computed(
    () =>
      plans[
        this.route.snapshot.paramMap.get('plan') as keyof typeof plans
      ] ?? plans.free,
  );
}
