import { Component, OnInit } from '@angular/core';

import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { ProfileService, AppStateService } from '@services';
import { ModalComponent } from './modal.component';

@Component({
  selector: 'app-profile-form-modal',
  standalone: true,
  imports: [ReactiveFormsModule, ModalComponent],
  template: `
    <app-modal 
      [isOpen]="isOpen" 
      [title]="'Create New Profile'"
      (onClose)="close()">
      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4">
        <div>
          <label class="block text-xs font-medium text-slate-700 mb-1">
            Profile Name
          </label>
          <input
            formControlName="profileName"
            placeholder="e.g. Spouse"
            class="w-full p-2 border rounded-lg text-sm"
            [class.border-red-500]="form.get('profileName')?.invalid && form.get('profileName')?.touched"
          />
          @if (form.get('profileName')?.hasError('required') && form.get('profileName')?.touched) {
            <p class="text-xs text-red-500 mt-1">Profile name is required</p>
          }
        </div>
        <button
          type="submit"
          [disabled]="form.invalid"
          class="w-full bg-slate-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed">
          Create Profile
        </button>
      </form>
    </app-modal>
  `
})
export class ProfileFormModalComponent implements OnInit {
  form!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private profileService: ProfileService,
    public appState: AppStateService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      profileName: ['', [Validators.required, Validators.minLength(1)]]
    });
  }

  get isOpen(): boolean {
    return this.appState.modalState().type === 'profile-form';
  }

  onSubmit(): void {
    if (this.form.valid) {
      const name = this.form.value.profileName.trim();
      this.profileService.addProfile(name);
      this.form.reset();
      this.close();
    }
  }

  close(): void {
    this.form.reset();
    this.appState.closeModal();
  }
}
