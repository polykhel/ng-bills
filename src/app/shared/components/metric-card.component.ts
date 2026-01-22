import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, LucideIconData } from 'lucide-angular';

export type MetricVariant = 'default' | 'success' | 'warning' | 'danger' | 'info';

/**
 * Metric Card Component
 * Displays a financial metric with icon, label, value, and optional change indicator
 */
@Component({
  selector: 'app-metric-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div [class]="cardClasses()">
      <div class="flex items-start justify-between">
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-1">
            @if (icon()) {
              <lucide-angular 
                [img]="icon()!" 
                [size]="20" 
                [class]="iconClasses()"
              />
            }
            <span class="text-sm font-medium text-slate-600">{{ label() }}</span>
          </div>
          <div class="text-2xl font-bold text-slate-900">
            {{ value() }}
          </div>
          @if (subtitle()) {
            <div class="text-xs text-slate-500 mt-1">{{ subtitle() }}</div>
          }
        </div>
        @if (change() !== undefined) {
          <div [class]="changeClasses()">
            {{ changePrefix() }}{{ change() }}{{ changeSuffix() }}
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class MetricCardComponent {
  icon = input<LucideIconData>();
  label = input.required<string>();
  value = input.required<string>();
  subtitle = input<string>();
  variant = input<MetricVariant>('default');
  change = input<number>();
  changePrefix = input<string>('');
  changeSuffix = input<string>('%');
  
  cardClasses = () => {
    const base = 'bg-white rounded-lg border p-4 shadow-sm';
    const variants: Record<MetricVariant, string> = {
      default: 'border-slate-200',
      success: 'border-green-200 bg-green-50',
      warning: 'border-yellow-200 bg-yellow-50',
      danger: 'border-red-200 bg-red-50',
      info: 'border-blue-200 bg-blue-50',
    };
    return `${base} ${variants[this.variant()]}`;
  };
  
  iconClasses = () => {
    const variants: Record<MetricVariant, string> = {
      default: 'text-slate-600',
      success: 'text-green-600',
      warning: 'text-yellow-600',
      danger: 'text-red-600',
      info: 'text-blue-600',
    };
    return variants[this.variant()];
  };
  
  changeClasses = () => {
    const change = this.change();
    if (change === undefined) return '';
    
    const base = 'text-xs font-semibold px-2 py-1 rounded';
    if (change > 0) {
      return `${base} bg-green-100 text-green-700`;
    } else if (change < 0) {
      return `${base} bg-red-100 text-red-700`;
    }
    return `${base} bg-slate-100 text-slate-700`;
  };
}
