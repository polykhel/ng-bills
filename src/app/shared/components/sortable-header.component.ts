import { Component, Input, Output, EventEmitter } from '@angular/core';

import { LucideAngularModule, ArrowUpDown } from 'lucide-angular';
import { UtilsService } from '../../core/services';
import type { SortConfig } from '../types';

@Component({
  selector: 'app-sortable-header',
  standalone: true,
  imports: [LucideAngularModule],
  template: `
    <th 
      [class]="cn('p-4 cursor-pointer hover:bg-slate-100 transition-colors select-none group', className)"
      [style]="style"
      (click)="onSort.emit(sortKey)">
      <div class="flex items-center gap-2">
        {{ label }}
        <lucide-icon 
          [img]="ArrowUpDown" 
          [class]="cn('w-3 h-3 transition-opacity', isActive ? 'opacity-100 text-blue-600' : 'opacity-30 group-hover:opacity-60')">
        </lucide-icon>
      </div>
      <ng-content></ng-content>
    </th>
  `
})
export class SortableHeaderComponent {
  @Input() label = '';
  @Input() sortKey = '';
  @Input() currentSort!: SortConfig;
  @Input() className = '';
  @Input() style: any = {};
  
  @Output() onSort = new EventEmitter<string>();

  readonly ArrowUpDown = ArrowUpDown;

  constructor(private utils: UtilsService) {}

  get isActive(): boolean {
    return this.currentSort?.key === this.sortKey;
  }

  cn(...inputs: any[]): string {
    return this.utils.cn(...inputs);
  }
}
