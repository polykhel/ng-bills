import { Component, EventEmitter, forwardRef, Input, Output } from '@angular/core';

import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-editable-field',
  standalone: true,
  imports: [FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => EditableFieldComponent),
      multi: true
    }
  ],
  templateUrl: './editable-field.component.html',
})
export class EditableFieldComponent implements ControlValueAccessor {
  @Input() type: 'text' | 'number' | 'date' = 'text';
  @Input() className = '';
  @Input() placeholder = '';
  @Input() step?: string;
  @Input() min?: string;
  @Input() max?: string;
  @Input() id?: string;

  @Output() onUpdate = new EventEmitter<string | number>();

  localValue: string | number = '';
  isEditing = false;
  private originalValue: string | number = '';

  writeValue(value: any): void {
    this.localValue = value ?? '';
    this.originalValue = value ?? '';
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  handleFocus(): void {
    this.isEditing = true;
    this.originalValue = this.localValue;
  }

  handleBlur(): void {
    this.isEditing = false;
    this.onTouched();

    // Only update if value has changed
    if (this.localValue !== this.originalValue) {
      this.onChange(this.localValue);
      this.onUpdate.emit(this.localValue);
    }
  }

  handleChange(): void {
    if (this.type === 'number') {
      // Keep as is for number inputs
    }
  }

  // ControlValueAccessor implementation
  private onChange: (value: any) => void = () => {
  };

  private onTouched: () => void = () => {
  };
}
