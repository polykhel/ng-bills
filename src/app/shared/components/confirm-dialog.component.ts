import { Component, Input, Output, EventEmitter } from '@angular/core';

import { LucideAngularModule, AlertCircle } from 'lucide-angular';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [LucideAngularModule],
  template: `
    @if (isOpen) {
      <div 
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        (click)="onClose.emit()">
        <div 
          class="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200"
          (click)="$event.stopPropagation()">
          <div [class]="'p-4 ' + variantStyles[variant].bg">
            <div class="flex items-start gap-3">
              <lucide-icon 
                [img]="AlertCircle" 
                [class]="'w-6 h-6 flex-shrink-0 mt-0.5 ' + variantStyles[variant].icon">
              </lucide-icon>
              <div class="flex-1">
                <h3 class="font-semibold text-gray-900 mb-1">{{ title }}</h3>
                <p class="text-sm text-gray-700">{{ message }}</p>
              </div>
            </div>
          </div>
          <div class="p-4 flex gap-2 justify-end">
            <button
              (click)="onClose.emit()"
              class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">
              {{ cancelText }}
            </button>
            <button
              (click)="handleConfirm()"
              [class]="'px-4 py-2 text-sm font-medium text-white rounded-md transition-colors ' + variantStyles[variant].button">
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class ConfirmDialogComponent {
  @Input() isOpen = false;
  @Input() title = '';
  @Input() message = '';
  @Input() confirmText = 'Confirm';
  @Input() cancelText = 'Cancel';
  @Input() variant: 'warning' | 'danger' | 'info' = 'warning';
  
  @Output() onClose = new EventEmitter<void>();
  @Output() onConfirm = new EventEmitter<void>();

  readonly AlertCircle = AlertCircle;

  readonly variantStyles = {
    warning: {
      bg: 'bg-yellow-50',
      icon: 'text-yellow-600',
      button: 'bg-yellow-600 hover:bg-yellow-700',
    },
    danger: {
      bg: 'bg-red-50',
      icon: 'text-red-600',
      button: 'bg-red-600 hover:bg-red-700',
    },
    info: {
      bg: 'bg-blue-50',
      icon: 'text-blue-600',
      button: 'bg-blue-600 hover:bg-blue-700',
    },
  };

  handleConfirm(): void {
    this.onConfirm.emit();
    this.onClose.emit();
  }
}
