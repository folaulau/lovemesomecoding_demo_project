import type { Crust, Product, Topping } from '../types';

/**
 * Mock menu data.
 *
 * Phase 2 builds the entire UI against these constants so the frontend can be designed and
 * reviewed without the backend running. The values deliberately match the Liquibase seed in
 * pizza-springboot-backend, so swapping to real API calls in Phase 4 should change nothing
 * visible on screen — a useful way to prove the integration did not break anything.
 */

export const MOCK_PIZZAS: Product[] = [
  {
    id: 1,
    name: 'Pepperoni Pizza',
    description: 'Classic pepperoni over mozzarella and our signature sauce',
    type: 'PIZZA',
    imageUrl: null,
    sizes: [
      { size: 'SMALL', price: 10.99 },
      { size: 'MEDIUM', price: 13.99 },
      { size: 'LARGE', price: 16.99 },
    ],
  },
  {
    id: 2,
    name: 'Cheese Pizza',
    description: 'Simple, generous mozzarella on a hand-stretched base',
    type: 'PIZZA',
    imageUrl: null,
    sizes: [
      { size: 'SMALL', price: 9.99 },
      { size: 'MEDIUM', price: 12.99 },
      { size: 'LARGE', price: 15.49 },
    ],
  },
  {
    id: 3,
    name: 'Supreme Pizza',
    description: 'Pepperoni, sausage, peppers, onions, mushrooms and olives',
    type: 'PIZZA',
    imageUrl: null,
    sizes: [
      { size: 'SMALL', price: 13.49 },
      { size: 'MEDIUM', price: 16.99 },
      { size: 'LARGE', price: 19.99 },
    ],
  },
  {
    id: 4,
    name: 'Meat Lovers Pizza',
    description: 'Pepperoni, sausage, bacon and ham. No vegetables were harmed',
    type: 'PIZZA',
    imageUrl: null,
    sizes: [
      { size: 'SMALL', price: 13.99 },
      { size: 'MEDIUM', price: 17.49 },
      { size: 'LARGE', price: 20.99 },
    ],
  },
  {
    id: 5,
    name: 'Veggie Lovers Pizza',
    description: 'Mushrooms, peppers, onions, olives and tomatoes',
    type: 'PIZZA',
    imageUrl: null,
    sizes: [
      { size: 'SMALL', price: 12.49 },
      { size: 'MEDIUM', price: 15.99 },
      { size: 'LARGE', price: 18.99 },
    ],
  },
  {
    id: 6,
    name: 'BBQ Chicken Pizza',
    description: 'Grilled chicken and red onion over smoky BBQ sauce',
    type: 'PIZZA',
    imageUrl: null,
    sizes: [
      { size: 'SMALL', price: 13.49 },
      { size: 'MEDIUM', price: 16.99 },
      { size: 'LARGE', price: 19.99 },
    ],
  },
  {
    id: 7,
    name: 'Hawaiian Pizza',
    description: 'Ham and pineapple. We are not getting into the debate',
    type: 'PIZZA',
    imageUrl: null,
    sizes: [
      { size: 'SMALL', price: 12.49 },
      { size: 'MEDIUM', price: 15.49 },
      { size: 'LARGE', price: 18.49 },
    ],
  },
  {
    id: 8,
    name: 'Buffalo Chicken Pizza',
    description: 'Grilled chicken tossed in buffalo sauce with a ranch drizzle',
    type: 'PIZZA',
    imageUrl: null,
    sizes: [
      { size: 'SMALL', price: 13.49 },
      { size: 'MEDIUM', price: 16.99 },
      { size: 'LARGE', price: 19.99 },
    ],
  },
];

export const MOCK_DRINKS: Product[] = [
  {
    id: 20,
    name: 'Pepsi',
    description: 'Chilled Pepsi',
    type: 'DRINK',
    imageUrl: null,
    sizes: [
      { size: 'SMALL', price: 1.99 },
      { size: 'MEDIUM', price: 2.49 },
      { size: 'LARGE', price: 2.99 },
    ],
  },
  {
    id: 21,
    name: 'Diet Pepsi',
    description: 'Chilled Diet Pepsi',
    type: 'DRINK',
    imageUrl: null,
    sizes: [
      { size: 'SMALL', price: 1.99 },
      { size: 'MEDIUM', price: 2.49 },
      { size: 'LARGE', price: 2.99 },
    ],
  },
  {
    id: 22,
    name: 'Mountain Dew',
    description: 'Chilled Mountain Dew',
    type: 'DRINK',
    imageUrl: null,
    sizes: [
      { size: 'SMALL', price: 1.99 },
      { size: 'MEDIUM', price: 2.49 },
      { size: 'LARGE', price: 2.99 },
    ],
  },
  {
    id: 23,
    name: 'Starry',
    description: 'Lemon lime soda',
    type: 'DRINK',
    imageUrl: null,
    sizes: [
      { size: 'SMALL', price: 1.99 },
      { size: 'MEDIUM', price: 2.49 },
      { size: 'LARGE', price: 2.99 },
    ],
  },
  {
    id: 24,
    name: 'Bottled Water',
    description: 'Still water',
    type: 'DRINK',
    imageUrl: null,
    sizes: [
      { size: 'SMALL', price: 1.49 },
      { size: 'MEDIUM', price: 1.99 },
      { size: 'LARGE', price: 2.49 },
    ],
  },
  {
    id: 25,
    name: 'Iced Tea',
    description: 'Freshly brewed, unsweetened',
    type: 'DRINK',
    imageUrl: null,
    sizes: [
      { size: 'SMALL', price: 1.99 },
      { size: 'MEDIUM', price: 2.49 },
      { size: 'LARGE', price: 2.99 },
    ],
  },
];

export const MOCK_TOPPINGS: Topping[] = [
  { id: 1, name: 'Pepperoni', price: 1.5, category: 'MEAT' },
  { id: 2, name: 'Italian Sausage', price: 1.5, category: 'MEAT' },
  { id: 3, name: 'Bacon', price: 1.75, category: 'MEAT' },
  { id: 4, name: 'Grilled Chicken', price: 2.0, category: 'MEAT' },
  { id: 5, name: 'Ham', price: 1.5, category: 'MEAT' },
  { id: 6, name: 'Mushrooms', price: 1.0, category: 'VEGGIE' },
  { id: 7, name: 'Green Peppers', price: 1.0, category: 'VEGGIE' },
  { id: 8, name: 'Red Onions', price: 1.0, category: 'VEGGIE' },
  { id: 9, name: 'Black Olives', price: 1.0, category: 'VEGGIE' },
  { id: 10, name: 'Jalapenos', price: 1.0, category: 'VEGGIE' },
  { id: 11, name: 'Extra Cheese', price: 1.75, category: 'CHEESE' },
  { id: 12, name: 'Parmesan', price: 1.25, category: 'CHEESE' },
];

export const MOCK_CRUSTS: Crust[] = [
  { id: 1, name: 'Original Pan', priceDelta: 0 },
  { id: 2, name: 'Hand Tossed', priceDelta: 0 },
  { id: 3, name: "Thin 'N Crispy", priceDelta: 0 },
  { id: 4, name: 'Stuffed Crust', priceDelta: 2.5 },
];

export const MOCK_MENU: Product[] = [...MOCK_PIZZAS, ...MOCK_DRINKS];
