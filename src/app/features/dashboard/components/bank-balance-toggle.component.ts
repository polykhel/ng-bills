import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-bank-balance-toggle',
  standalone: true,
  imports: [],
  templateUrl: './bank-balance-toggle.component.html',
})
export class BankBalanceToggleComponent {
  @Input() enabled = false;
  @Output() enable = new EventEmitter<void>();
}
