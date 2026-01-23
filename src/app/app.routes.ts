import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: '/overview',
    pathMatch: 'full',
  },
  // Primary Navigation
  {
    path: 'overview',
    loadComponent: () =>
      import('./features/overview/overview.component').then(
        m => m.OverviewComponent
      ),
  },
  {
    path: 'transactions',
    loadComponent: () =>
      import('./features/transactions/transactions.component').then(
        m => m.TransactionsComponent
      ),
  },
  {
    path: 'bills',
    loadComponent: () =>
      import('./features/bills/bills.component').then(
        m => m.BillsComponent
      ),
  },
  {
    path: 'budget',
    loadComponent: () =>
      import('./features/budget/budget.component').then(
        m => m.BudgetComponent
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
  {
    path: 'savings-goals',
    loadComponent: () =>
      import('./features/savings-goals/savings-goals.component').then(
        m => m.SavingsGoalsComponent
      ),
  },
  {
    path: 'planned-purchases',
    loadComponent: () =>
      import('./features/planned-purchases/planned-purchases.component').then(
        m => m.PlannedPurchasesComponent
      ),
  },
  {
    path: 'loan-planning',
    loadComponent: () =>
      import('./features/loan-planning/loan-planning.component').then(
        m => m.LoanPlanningComponent
      ),
  },
];
