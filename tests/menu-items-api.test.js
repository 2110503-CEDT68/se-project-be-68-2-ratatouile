const mongoose = require('mongoose');

const Restaurant = require('../models/Restaurant');
const {
  getMenuItems,
  addMenuItem,
  updateMenuItem,
  deleteMenuItem,
} = require('../controllers/menuItems');
const { createUser } = require('./helpers/auth');
const { createMockResponse } = require('./helpers/http');

const buildRestaurant = ({ owner, menu = [] } = {}) => {
  const restaurant = new Restaurant({
    _id: new mongoose.Types.ObjectId(),
    owner: owner?.id || new mongoose.Types.ObjectId(),
    name: 'Menu Route Bistro',
    address: '123 Menu Route',
    telephone: '0212345678',
    openTime: '10:00',
    closeTime: '22:00',
    menu,
  });

  restaurant.save = jest.fn().mockResolvedValue(restaurant);

  return restaurant;
};

describe('Restaurant menu item controller requirements', () => {
  it('lists menu items for a restaurant', async () => {
    const restaurant = buildRestaurant({
      menu: [{ name: 'Pad Thai', price: 90 }],
    });
    const req = { params: { restaurantId: String(restaurant._id) } };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);

    await getMenuItems(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(1);
    expect(res.body.data[0].name).toBe('Pad Thai');
  });

  it('returns not found when listing menu items for a missing restaurant', async () => {
    const restaurantId = new mongoose.Types.ObjectId();
    const req = { params: { restaurantId: String(restaurantId) } };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(null);

    await getMenuItems(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body).toEqual({
      success: false,
      error: `Restaurant not found with id of ${restaurantId}`,
    });
  });

  it('handles menu list lookup failures', async () => {
    const req = { params: { restaurantId: String(new mongoose.Types.ObjectId()) } };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockRejectedValue(new Error('lookup failed'));

    await getMenuItems(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({
      success: false,
      error: 'lookup failed',
    });
  });

  it('adds a menu item for the restaurant owner', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = buildRestaurant({ owner });
    const req = {
      params: { restaurantId: String(restaurant._id) },
      user: owner,
      body: {
        name: 'Green Curry',
        description: 'Coconut curry',
        price: 120,
        category: 'Thai',
        picture: 'https://example.com/curry.jpg',
      },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);

    await addMenuItem(req, res);

    expect(restaurant.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.body.message).toBe('Menu item added successfully');
    expect(res.body.data.name).toBe('Green Curry');
    expect(res.body.data.picture).toBe('https://example.com/curry.jpg');
  });

  it('returns not found when adding a menu item to a missing restaurant', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurantId = new mongoose.Types.ObjectId();
    const req = {
      params: { restaurantId: String(restaurantId) },
      user: owner,
      body: { name: 'Missing Restaurant Dish' },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(null);

    await addMenuItem(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('blocks menu item creation for another restaurant owner', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const otherOwner = createUser({ role: 'restaurantOwner' });
    const restaurant = buildRestaurant({ owner });
    const req = {
      params: { restaurantId: String(restaurant._id) },
      user: otherOwner,
      body: { name: 'Illegal Dish' },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);

    await addMenuItem(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toEqual({
      success: false,
      error: 'Not authorized to update this restaurant menu',
    });
    expect(restaurant.save).not.toHaveBeenCalled();
  });

  it('blocks menu item creation when no user is present', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = buildRestaurant({ owner });
    const req = {
      params: { restaurantId: String(restaurant._id) },
      body: { name: 'Anonymous Dish' },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);

    await addMenuItem(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('validates mandatory menu item fields when adding a menu item', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = buildRestaurant({ owner });
    const validationError = new Restaurant({
      name: 'Validation Bistro',
      address: '123 Validation Road',
      telephone: '0212345678',
      openTime: '10:00',
      closeTime: '22:00',
      menu: [{ price: -1 }],
    }).validateSync();
    const req = {
      params: { restaurantId: String(restaurant._id) },
      user: owner,
      body: { price: -1 },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    restaurant.save.mockRejectedValue(validationError);

    await addMenuItem(req, res);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toEqual(
      expect.arrayContaining([
        'Please add a menu item name',
        'Menu item price must be greater than or equal to 0',
      ])
    );
  });

  it('updates a menu item for an admin', async () => {
    const admin = createUser({ role: 'admin' });
    const restaurant = buildRestaurant({
      menu: [{ name: 'Old Dish', price: 80 }],
    });
    const menuItemId = String(restaurant.menu[0]._id);
    const req = {
      params: {
        restaurantId: String(restaurant._id),
        menuItemId,
      },
      user: admin,
      body: {
        name: 'Updated Dish',
        price: 95,
      },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);

    await updateMenuItem(req, res);

    expect(restaurant.save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.message).toBe('Menu item updated successfully');
    expect(res.body.data.name).toBe('Updated Dish');
    expect(res.body.data.price).toBe(95);
  });

  it('returns not found when updating a menu item for a missing restaurant', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const req = {
      params: {
        restaurantId: String(new mongoose.Types.ObjectId()),
        menuItemId: String(new mongoose.Types.ObjectId()),
      },
      user: owner,
      body: { name: 'Missing Update' },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(null);

    await updateMenuItem(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('blocks menu item updates for another restaurant owner', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const otherOwner = createUser({ role: 'restaurantOwner' });
    const restaurant = buildRestaurant({
      owner,
      menu: [{ name: 'Protected Dish' }],
    });
    const req = {
      params: {
        restaurantId: String(restaurant._id),
        menuItemId: String(restaurant.menu[0]._id),
      },
      user: otherOwner,
      body: { name: 'Illegal Update' },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);

    await updateMenuItem(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(restaurant.save).not.toHaveBeenCalled();
  });

  it('returns not found when updating a missing menu item', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = buildRestaurant({ owner, menu: [{ name: 'Only Dish' }] });
    const missingMenuItemId = new mongoose.Types.ObjectId();
    const req = {
      params: {
        restaurantId: String(restaurant._id),
        menuItemId: String(missingMenuItemId),
      },
      user: owner,
      body: { name: 'Missing Dish' },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);

    await updateMenuItem(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body).toEqual({
      success: false,
      error: `Menu item not found with id of ${missingMenuItemId}`,
    });
  });

  it('handles generic menu item update failures', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = buildRestaurant({ owner, menu: [{ name: 'Broken Dish' }] });
    const req = {
      params: {
        restaurantId: String(restaurant._id),
        menuItemId: String(restaurant.menu[0]._id),
      },
      user: owner,
      body: { name: 'Still Broken' },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    restaurant.save.mockRejectedValue(new Error('update failed'));

    await updateMenuItem(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({
      success: false,
      error: 'update failed',
    });
  });

  it('deletes a menu item for the restaurant owner', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = buildRestaurant({
      owner,
      menu: [{ name: 'Delete Dish', price: 50 }],
    });
    const menuItemId = String(restaurant.menu[0]._id);
    const req = {
      params: {
        restaurantId: String(restaurant._id),
        menuItemId,
      },
      user: owner,
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);

    await deleteMenuItem(req, res);

    expect(restaurant.save).toHaveBeenCalled();
    expect(restaurant.menu.id(menuItemId)).toBeNull();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({
      success: true,
      message: 'Menu item deleted successfully',
      data: {},
    });
  });

  it('returns not found when deleting a menu item for a missing restaurant', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const req = {
      params: {
        restaurantId: String(new mongoose.Types.ObjectId()),
        menuItemId: String(new mongoose.Types.ObjectId()),
      },
      user: owner,
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(null);

    await deleteMenuItem(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('blocks menu item deletion for another restaurant owner', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const otherOwner = createUser({ role: 'restaurantOwner' });
    const restaurant = buildRestaurant({
      owner,
      menu: [{ name: 'Protected Dish' }],
    });
    const req = {
      params: {
        restaurantId: String(restaurant._id),
        menuItemId: String(restaurant.menu[0]._id),
      },
      user: otherOwner,
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);

    await deleteMenuItem(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(restaurant.save).not.toHaveBeenCalled();
  });

  it('returns not found when deleting a missing menu item', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = buildRestaurant({ owner, menu: [{ name: 'Only Dish' }] });
    const missingMenuItemId = new mongoose.Types.ObjectId();
    const req = {
      params: {
        restaurantId: String(restaurant._id),
        menuItemId: String(missingMenuItemId),
      },
      user: owner,
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);

    await deleteMenuItem(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body.error).toBe(`Menu item not found with id of ${missingMenuItemId}`);
  });

  it('handles menu item delete failures with a default message', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = buildRestaurant({ owner, menu: [{ name: 'Broken Delete' }] });
    const req = {
      params: {
        restaurantId: String(restaurant._id),
        menuItemId: String(restaurant.menu[0]._id),
      },
      user: owner,
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    restaurant.save.mockRejectedValue({});

    await deleteMenuItem(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({
      success: false,
      error: 'Unable to process menu item request',
    });
  });
});
