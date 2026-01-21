import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, LucideIconData, ChevronRight } from 'lucide-angular';

/**
 * Section Header Component
 * Header for content sections with optional action link
 */
@Component({
  selector: 'app-section-header',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        @if (icon()) {
          <lucide-angular [img]="icon()!" [size]="24" class="text-slate-700" />
        }
        <h2 class="text-lg font-semibold text-slate-900">{{ title() }}</h2>
        @if (badge()) {
          <span class="px-2 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-700">
            {{ badge() }}
          </span>
        }
      </div>
      @if (actionLabel()) {
        <button
          type="button"
          (click)="action.emit()"
          class="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
        >
          <span>{{ actionLabel() }}</span>
          <lucide-angular [img]="ChevronRight" [size]="16" />
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
export class SectionHeaderComponent {
  readonly ChevronRight = ChevronRight;
  
  title = input.required<string>();
  icon = input<LucideIconData>();
  badge = input<string>();
  actionLabel = input<string>();
  action = output<void>();
}
