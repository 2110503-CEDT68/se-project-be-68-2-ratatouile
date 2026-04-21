const Restaurant = require('../models/Restaurant');

const buildRestaurant = (menu) =>
  new Restaurant({
    name: 'Menu Test Bistro',
    address: '123 Menu Street',
    telephone: '0212345678',
    openTime: '10:00',
    closeTime: '22:00',
    menu,
  });

describe('Restaurant menu item schema', () => {
  it('accepts valid menu items and trims text fields', () => {
    const restaurant = buildRestaurant([
      {
        name: '  Green Curry  ',
        description: '  Rich coconut curry  ',
        price: 120,
        category: '  Thai  ',
      },
    ]);

    const error = restaurant.validateSync();

    expect(error).toBeUndefined();
    expect(restaurant.menu[0].name).toBe('Green Curry');
    expect(restaurant.menu[0].description).toBe('Rich coconut curry');
    expect(restaurant.menu[0].category).toBe('Thai');
  });

  it('requires a menu item name', () => {
    const restaurant = buildRestaurant([
      {
        description: 'Missing name',
        price: 80,
        category: 'Starter',
      },
    ]);

    const error = restaurant.validateSync();

    expect(error.errors['menu.0.name'].message).toBe('Please add a menu item name');
  });

  it('limits menu item text lengths', () => {
    const restaurant = buildRestaurant([
      {
        name: 'N'.repeat(101),
        description: 'D'.repeat(301),
        price: 80,
        category: 'C'.repeat(51),
      },
    ]);

    const error = restaurant.validateSync();

    expect(error.errors['menu.0.name'].message).toBe(
      'Menu item name can not be more than 100 characters'
    );
    expect(error.errors['menu.0.description'].message).toBe(
      'Menu item description can not be more than 300 characters'
    );
    expect(error.errors['menu.0.category'].message).toBe(
      'Menu item category can not be more than 50 characters'
    );
  });

  it('rejects negative menu item prices', () => {
    const restaurant = buildRestaurant([
      {
        name: 'Tom Yum',
        price: -1,
      },
    ]);

    const error = restaurant.validateSync();

    expect(error.errors['menu.0.price'].message).toBe(
      'Menu item price must be greater than or equal to 0'
    );
  });
});
