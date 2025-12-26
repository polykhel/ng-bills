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
  template: `
    @if (options.length) {
      <div
        class="relative inline-block text-left"
        (keydown.escape)="open = false"
      >
        <button
          type="button"
          (click)="toggleOpen()"
          [attr.aria-expanded]="open"
          aria-haspopup="menu"
          aria-label="Toggle column visibility menu"
          class="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg shadow-sm hover:border-slate-300 transition"
        >
          Columns
        </button>

        @if (open) {
          <div
            class="absolute right-0 mt-1 w-48 rounded-lg border border-slate-200 bg-white shadow-lg z-20"
            role="menu"
            aria-label="Column visibility options"
          >
            <div class="max-h-64 overflow-auto p-2 space-y-1 text-sm">
              @for (col of options; track col.key) {
                <label
                  class="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 cursor-pointer"
                  [class.opacity-60]="col.canHide === false"
                >
                  <input
                    type="checkbox"
                    class="accent-blue-600"
                    [checked]="col.visible"
                    [disabled]="col.canHide === false"
                    [attr.aria-label]="'Toggle column ' + col.label"
                    (change)="onToggle(col, !!$any($event.target).checked)"
                  />
                  <span class="text-slate-700 text-xs truncate">{{ col.label }}</span>
                </label>
              }
            </div>
            <div class="flex items-center justify-between px-2 py-2 border-t border-slate-100">
              <button type="button" (click)="reset.emit()" class="text-xs text-blue-600 hover:text-blue-800 font-medium">
                Reset
              </button>
              <button type="button" (click)="open = false" class="text-xs text-slate-500 hover:text-slate-700">
                Close
              </button>
            </div>
          </div>
        }
      </div>
    }
  `,
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
