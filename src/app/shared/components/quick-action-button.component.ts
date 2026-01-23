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
      [class]="disabled() ? 'btn btn-disabled' : (variant() === 'primary' ? 'btn btn-primary' : 'btn btn-secondary')"
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
