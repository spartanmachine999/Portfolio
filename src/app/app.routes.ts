import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home';

export const routes: Routes = [
  { path: '', component: HomeComponent, title: 'Mohak Saxena — Associate Product Manager' },
  // Lazy so the 404 page and its little game never load for normal visitors.
  {
    path: '**',
    loadComponent: () => import('./pages/not-found/not-found').then((m) => m.NotFoundComponent),
    title: 'Lost in space — Mohak Saxena',
  },
];
