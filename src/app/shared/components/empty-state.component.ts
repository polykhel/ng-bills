import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, LucideIconData } from 'lucide-angular';

/**
 * Empty State Component
 * Displays when there's no data to show
 */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="flex flex-col items-center justify-center py-12 px-4 text-center">
      @if (icon()) {
        <div class="mb-4 p-4 rounded-full bg-slate-100">
          <lucide-angular [img]="icon()!" [size]="48" class="text-slate-400" />
        </div>
      }
      <h3 class="text-lg font-semibold text-slate-900 mb-2">
        {{ title() }}
      </h3>
      @if (message()) {
        <p class="text-slate-600 mb-6 max-w-md">
          {{ message() }}
        </p>
      }
      @if (actionLabel()) {
        <button
          type="button"
          (click)="action.emit()"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          {{ actionLabel() }}
        </button>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class EmptyStateComponent {
  icon = input<LucideIconData>();
  title = input.required<string>();
  message = input<string>();
  actionLabel = input<string>();
  action = output<void>();
}
