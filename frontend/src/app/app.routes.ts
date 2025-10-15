import { Routes } from '@angular/router';
import { CarListPageComponent } from './pages/cars/car-list.page';
// Pilot mode: admin/create routes disabled. Re-enable by uncommenting.
// import { CarManagePageComponent } from './pages/cars/car-manage.page';
// import { CarCreatePageComponent } from './pages/cars/car-create.page';
// import { CarBulkCreatePageComponent } from './pages/cars/car-bulk.page';
import { CarDetailsPageComponent } from './pages/cars/car-details.page';
// import { CarEditPageComponent } from './pages/cars/car-edit.page';
import { HomePageComponent } from './pages/home/home.page';

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: HomePageComponent },
  { path: 'cars', component: CarListPageComponent },
  // { path: 'cars/manage', component: CarManagePageComponent },
  // { path: 'cars/create', component: CarCreatePageComponent },
  // { path: 'cars/bulk', component: CarBulkCreatePageComponent },
  // { path: 'cars/:id/edit', component: CarEditPageComponent },
  { path: 'cars/:id', component: CarDetailsPageComponent },
];
