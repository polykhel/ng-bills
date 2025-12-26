import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface ColumnVisibilityOption {
  key: string;
  label: string;
  canHide?: boolean;
  visible: boolean;
}

@Component({
  selector: 'app-column-visibility-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './column-visibility-menu.component.html',
})
export class ColumnVisibilityMenuComponent {
  @Input() options: ColumnVisibilityOption[] = [];
  @Output() toggle = new EventEmitter<{ key: string; visible: boolean }>();
  @Output() reset = new EventEmitter<void>();

  open = false;

  toggleOpen(): void {
    this.open = !this.open;
  }

  onToggle(col: ColumnVisibilityOption, visible: boolean): void {
    this.toggle.emit({ key: col.key, visible });
  }
}
