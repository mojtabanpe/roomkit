import { Route } from '@angular/router';

export const appRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./features/lobby/lobby').then((m) => m.Lobby),
  },
  {
    path: 'room/:room',
    loadComponent: () => import('./features/room/room').then((m) => m.Room),
  },
  { path: '**', redirectTo: '' },
];
