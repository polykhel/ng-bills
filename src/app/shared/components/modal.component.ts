import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';


@Component({
  selector: 'app-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './modal.component.html',
})
export class ModalComponent {
  @Input() isOpen = false;
  @Input() title = '';
  @Input() maxWidthClass = 'max-w-md';
  @Output() onClose = new EventEmitter<void>();

  get modalClass(): string {
    return [
      'bg-white',
      'rounded-lg',
      'border',
      'border-slate-200',
      'shadow-xl',
      'w-full',
      this.maxWidthClass,
      'overflow-hidden',
      'max-h-[90vh]',
      'overflow-y-auto',
    ].join(' ');
  }
}
