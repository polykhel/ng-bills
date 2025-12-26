import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ArrowUpDown, LucideAngularModule } from 'lucide-angular';
import type { SortConfig } from '../types';

@Component({
  selector: 'app-sortable-header',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './sortable-header.component.html',
})
export class SortableHeaderComponent {
  @Input() label = '';
  @Input() sortKey = '';
  @Input() currentSort!: SortConfig;
  @Input() className = '';
  @Input() style: any = {};

  @Output() onSort = new EventEmitter<string>();

  readonly ArrowUpDown = ArrowUpDown;

  constructor() {
  }

  get isActive(): boolean {
    return this.currentSort?.key === this.sortKey;
  }


}
