import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import { LucideAngularModule, Users, Upload, Download } from 'lucide-angular';

@Component({
  selector: 'app-data-management',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  template: `
    <div class="bg-slate-900 text-white rounded-2xl shadow-lg p-6 flex flex-col md:flex-row items-center justify-between gap-6">
      <div>
        <h2 class="text-lg font-bold flex items-center gap-2">
          <lucide-icon [img]="Users" class="w-5 h-5 text-blue-400"></lucide-icon>
          Data Management
        </h2>
        <p class="text-slate-400 text-sm mt-1">Backup, restore, or move your profile data.</p>
      </div>
      <div class="flex items-center gap-3">
        <button
          type="button"
          (click)="importClick.emit()"
          class="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
          <lucide-icon [img]="Upload" class="w-4 h-4"></lucide-icon>
          Import Profile (JSON)
        </button>
        <button
          type="button"
          (click)="exportClick.emit()"
          class="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-lg shadow-blue-900/50">
          <lucide-icon [img]="Download" class="w-4 h-4"></lucide-icon>
          Export Profile (JSON)
        </button>
      </div>
    </div>
  `
})
export class DataManagementComponent {
  @Output() importClick = new EventEmitter<void>();
  @Output() exportClick = new EventEmitter<void>();

  readonly Users = Users;
  readonly Upload = Upload;
  readonly Download = Download;
}
