import { Pipe, PipeTransform } from '@angular/core';

/**
 * Formats a number with Persian digits, optionally zero-padded.
 * `{{ 7 | faNumber: 2 }}` → «۰۷»
 */
@Pipe({ name: 'faNumber' })
export class FaNumber implements PipeTransform {
  transform(value: number | null | undefined, minIntegerDigits = 1): string {
    if (value == null || Number.isNaN(value)) return '';
    return new Intl.NumberFormat('fa-IR', {
      minimumIntegerDigits: minIntegerDigits,
      useGrouping: false,
    }).format(value);
  }
}
