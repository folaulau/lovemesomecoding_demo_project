import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <div class="container py-5 text-center">
      <h1 class="h4">Page not found</h1>
      <a routerLink="/menu" class="btn btn-primary mt-3">Browse the menu</a>
    </div>
  `,
})
export class NotFound {}
