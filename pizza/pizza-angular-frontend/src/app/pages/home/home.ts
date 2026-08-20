import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MenuService } from '../../core/menu.service';
import { MoneyPipe } from '../../core/money.pipe';
import { Spinner } from '../../shared/spinner/spinner';

@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, MoneyPipe, Spinner],
  templateUrl: './home.html',
})
export class Home {
  private readonly menu = inject(MenuService);

  readonly loading = this.menu.loading;
  readonly featured = computed(() => this.menu.pizzas().slice(0, 3));

  cheapest(prices: Array<{ price: number }>): number {
    return Math.min(...prices.map((s) => s.price));
  }
}
