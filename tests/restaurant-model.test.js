const mongoose = require('mongoose');

const Restaurant = require('../models/Restaurant');
const MenuItem = require('../models/MenuItem');

const restaurantId = new mongoose.Types.ObjectId();

const buildMenuItem = (overrides = {}) =>
  new MenuItem({
    restaurant: restaurantId,
    name: 'Green Curry',
    description: 'Rich coconut curry',
    price: 120,
    category: 'Thai',
    ...overrides,
  });

describe('Restaurant and menu item models', () => {
  it('exposes menu as a virtual instead of a stored restaurant path', () => {
    expect(Restaurant.schema.path('menu')).toBeUndefined();
    expect(Restaurant.schema.virtualpath('menu').options).toEqual(
      expect.objectContaining({
        ref: 'MenuItem',
        localField: '_id',
        foreignField: 'restaurant',
        justOne: false,
      })
    );
  });

  it('accepts valid menu items and trims text fields', () => {
    const menuItem = buildMenuItem({
      name: '  Green Curry  ',
      description: '  Rich coconut curry  ',
      category: '  Thai  ',
    });

    const error = menuItem.validateSync();

    expect(error).toBeUndefined();
    expect(menuItem.name).toBe('Green Curry');
    expect(menuItem.description).toBe('Rich coconut curry');
    expect(menuItem.category).toBe('Thai');
  });

  it('requires a restaurant reference', () => {
    const menuItem = buildMenuItem({
      restaurant: undefined,
    });

    const error = menuItem.validateSync();

    expect(error.errors.restaurant.message).toBe('Please add a restaurant');
  });

  it('requires a menu item name', () => {
    const menuItem = buildMenuItem({
      name: undefined,
    });

    const error = menuItem.validateSync();

    expect(error.errors.name.message).toBe('Please add a menu item name');
  });

  it('limits menu item text lengths', () => {
    const menuItem = buildMenuItem({
      name: 'N'.repeat(101),
      description: 'D'.repeat(301),
      category: 'C'.repeat(51),
    });

    const error = menuItem.validateSync();

    expect(error.errors.name.message).toBe(
      'Menu item name can not be more than 100 characters'
    );
    expect(error.errors.description.message).toBe(
      'Menu item description can not be more than 300 characters'
    );
    expect(error.errors.category.message).toBe(
      'Menu item category can not be more than 50 characters'
    );
  });

  it('rejects negative menu item prices', () => {
    const menuItem = buildMenuItem({
      price: -1,
    });

    const error = menuItem.validateSync();

    expect(error.errors.price.message).toBe(
      'Menu item price must be greater than or equal to 0'
    );
  });
});
