import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { HlmButton, HlmCardImports } from '@org/ui';
import { Logo } from '../../shared/logo';

@Component({ selector: 'app-pricing', imports: [RouterLink, Logo, HlmButton, HlmCardImports], templateUrl: './pricing.html', styleUrl: './pricing.scss' })
export class Pricing {}
