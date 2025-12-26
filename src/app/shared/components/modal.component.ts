import { Component, Input, Output, EventEmitter } from '@angular/core';


@Component({
  selector: 'app-modal',
  standalone: true,
  imports: [],
  template: `
    @if (isOpen) {
      <div 
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" 
        (click)="onClose.emit()">
        <div 
          class="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto" 
          (click)="$event.stopPropagation()">
          <div class="flex justify-between items-center p-4 border-b bg-slate-50 sticky top-0 z-10">
            <h3 class="font-semibold text-slate-800">{{ title }}</h3>
            <button 
              (click)="onClose.emit()" 
              class="text-slate-400 hover:text-slate-600" 
              aria-label="Close modal">
              ✕
            </button>
          </div>
          <div class="p-4">
            <ng-content></ng-content>
          </div>
        </div>
      </div>
    }
  `
})
export class ModalComponent {
  @Input() isOpen = false;
  @Input() title = '';
  @Output() onClose = new EventEmitter<void>();
}
