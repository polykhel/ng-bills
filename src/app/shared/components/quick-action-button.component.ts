import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, LucideIconData } from 'lucide-angular';

/**
 * Quick Action Button Component
 * Prominent button for primary actions
 */
@Component({
  selector: 'app-quick-action-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <button
      type="button"
      (click)="clicked.emit()"
      [disabled]="disabled()"
      class="flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      [class.bg-blue-600]="!disabled() && variant() === 'primary'"
      [class.text-white]="!disabled() && variant() === 'primary'"
      [class.hover:bg-blue-700]="!disabled() && variant() === 'primary'"
      [class.bg-white]="!disabled() && variant() === 'secondary'"
      [class.text-slate-700]="!disabled() && variant() === 'secondary'"
      [class.border]="variant() === 'secondary'"
      [class.border-slate-300]="variant() === 'secondary'"
      [class.hover:bg-slate-50]="!disabled() && variant() === 'secondary'"
    >
      @if (icon()) {
        <lucide-angular [img]="icon()!" [size]="20" />
      }
      <span>{{ label() }}</span>
    </button>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class QuickActionButtonComponent {
  label = input.required<string>();
  icon = input<LucideIconData>();
  variant = input<'primary' | 'secondary'>('primary');
  disabled = input<boolean>(false);
  clicked = output<void>();
}
