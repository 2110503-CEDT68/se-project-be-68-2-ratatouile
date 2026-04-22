const mongoose = require('mongoose');

const Restaurant = require('../models/Restaurant');
const Menu = require('../models/Menu');

const restaurantId = new mongoose.Types.ObjectId();

const buildMenu = (overrides = {}) =>
  new Menu({
    restaurant: restaurantId,
    title: 'Main Menu',
    description: 'Core dishes for the restaurant',
    items: [
      {
        name: 'Green Curry',
        description: 'Rich coconut curry',
        price: 120,
        category: 'Thai',
      },
    ],
    ...overrides,
  });

describe('Restaurant and menu models', () => {
  it('stores menu references on the restaurant schema', () => {
    expect(Restaurant.schema.path('menus').options.type[0]).toEqual(
      expect.objectContaining({
        type: mongoose.Schema.ObjectId,
        ref: 'Menu',
      })
    );
  });

  it('accepts valid menus and trims menu/item text fields', () => {
    const menu = buildMenu({
      title: '  Main Menu  ',
      description: '  Core dishes for the restaurant  ',
      items: [
        {
          name: '  Green Curry  ',
          description: '  Rich coconut curry  ',
          price: 120,
          category: '  Thai  ',
        },
      ],
    });

    const error = menu.validateSync();

    expect(error).toBeUndefined();
    expect(menu.title).toBe('Main Menu');
    expect(menu.description).toBe('Core dishes for the restaurant');
    expect(menu.items[0].name).toBe('Green Curry');
    expect(menu.items[0].description).toBe('Rich coconut curry');
    expect(menu.items[0].category).toBe('Thai');
  });

  it('defaults menu items to an empty array when omitted', () => {
    const menu = buildMenu({
      items: undefined,
    });

    expect(menu.items).toEqual([]);
  });

  it('requires a restaurant reference', () => {
    const menu = buildMenu({
      restaurant: undefined,
    });

    const error = menu.validateSync();

    expect(error.errors.restaurant.message).toBe('Please add a restaurant');
  });

  it('requires a menu title', () => {
    const menu = buildMenu({
      title: undefined,
    });

    const error = menu.validateSync();

    expect(error.errors.title.message).toBe('Please add a menu title');
  });

  it('limits menu and item text lengths', () => {
    const menu = buildMenu({
      title: 'T'.repeat(101),
      description: 'M'.repeat(301),
      items: [
        {
          name: 'N'.repeat(101),
          description: 'D'.repeat(301),
          category: 'C'.repeat(51),
        },
      ],
    });

    const error = menu.validateSync();

    expect(error.errors.title.message).toBe(
      'Menu title can not be more than 100 characters'
    );
    expect(error.errors.description.message).toBe(
      'Menu description can not be more than 300 characters'
    );
    expect(error.errors['items.0.name'].message).toBe(
      'Item name can not be more than 100 characters'
    );
    expect(error.errors['items.0.description'].message).toBe(
      'Item description can not be more than 300 characters'
    );
    expect(error.errors['items.0.category'].message).toBe(
      'Item category can not be more than 50 characters'
    );
  });

  it('rejects negative item prices', () => {
    const menu = buildMenu({
      items: [
        {
          name: 'Green Curry',
          price: -1,
        },
      ],
    });

    const error = menu.validateSync();

    expect(error.errors['items.0.price'].message).toBe(
      'Item price must be greater than or equal to 0'
    );
  });
});
