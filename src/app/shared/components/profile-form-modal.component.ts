import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';

import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AppStateService, ProfileService } from '@services';
import { ModalComponent } from './modal.component';

@Component({
  selector: 'app-profile-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ModalComponent],
  templateUrl: './profile-form-modal.component.html',
})
export class ProfileFormModalComponent implements OnInit {
  form!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private profileService: ProfileService,
    public appState: AppStateService
  ) {
  }

  get isOpen(): boolean {
    return this.appState.modalState().type === 'profile-form';
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      profileName: ['', [Validators.required, Validators.minLength(1)]]
    });
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
