import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, ArrowUpDown } from 'lucide-angular';
import type { SortConfig } from '../types';

@Component({
  selector: 'app-sortable-header',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <th 
      class="p-4 cursor-pointer hover:bg-slate-100 transition-colors select-none group"
      [ngClass]="className"
      [style]="style"
      (click)="onSort.emit(sortKey)">
      <div class="flex items-center gap-2">
        {{ label }}
        <lucide-icon 
          [img]="ArrowUpDown" 
          class="w-3 h-3 transition-opacity"
          [ngClass]="isActive ? ['opacity-100','text-blue-600'] : ['opacity-30','group-hover:opacity-60']">
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

  constructor() {}

  get isActive(): boolean {
    return this.currentSort?.key === this.sortKey;
  }

  
}
