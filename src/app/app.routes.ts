import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/dashboard',
    pathMatch: 'full',
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then(
        m => m.DashboardComponent
      ),
  },
  {
    path: 'calendar',
    loadComponent: () =>
      import('./features/calendar/calendar.component').then(
        m => m.CalendarComponent
      ),
  },
  {
    path: 'manage',
    loadComponent: () =>
      import('./features/manage/manage.component').then(
        m => m.ManageComponent
      ),
  },
  {
    path: 'sync',
    loadComponent: () =>
      import('./features/sync/sync.component').then(m => m.SyncComponent),
  },
];
