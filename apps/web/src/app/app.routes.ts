import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./features/landing/landing').then((m) => m.Landing),
  },
  {
    path: 'join',
    loadComponent: () => import('./features/lobby/lobby').then((m) => m.Lobby),
  },
  {
    path: 'pricing',
    loadComponent: () =>
      import('./features/pricing/pricing').then((m) => m.Pricing),
  },
  {
    path: 'checkout/:plan',
    loadComponent: () =>
      import('./features/pricing/checkout').then((m) => m.Checkout),
  },
  {
    path: 'tenant/register',
    loadComponent: () =>
      import('./features/tenant-signup/tenant-signup').then(
        (m) => m.TenantSignup,
      ),
  },
  {
    path: 'login',
    data: { mode: 'login' },
    loadComponent: () =>
      import('./features/auth/auth-page').then((m) => m.AuthPage),
  },
  {
    path: 'register',
    data: { mode: 'register' },
    loadComponent: () =>
      import('./features/auth/auth-page').then((m) => m.AuthPage),
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./features/profile/profile').then((m) => m.Profile),
  },
  {
    path: 't/:tenantKey/:room/call',
    loadComponent: () => import('./features/room/room').then((m) => m.Room),
  },
  {
    path: 't/:tenantKey/:room',
    loadComponent: () =>
      import('./features/tenant-room-entry/tenant-room-entry').then(
        (m) => m.TenantRoomEntry,
      ),
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./features/admin/admin-page').then((m) => m.AdminPage),
  },
  {
    path: 'room/:room',
    loadComponent: () => import('./features/room/room').then((m) => m.Room),
  },
  { path: '**', redirectTo: '' },
];
