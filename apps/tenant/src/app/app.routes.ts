import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./features/tenant-dashboard/tenant-dashboard').then(
        (module) => module.TenantDashboard,
      ),
  },
];
