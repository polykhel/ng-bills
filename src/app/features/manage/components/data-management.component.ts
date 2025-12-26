import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import { Download, LucideAngularModule, Upload, Users } from 'lucide-angular';

@Component({
  selector: 'app-data-management',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './data-management.component.html',
})
export class DataManagementComponent {
  @Output() importClick = new EventEmitter<void>();
  @Output() exportClick = new EventEmitter<void>();

  readonly Users = Users;
  readonly Upload = Upload;
  readonly Download = Download;
}
