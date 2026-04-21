const mongoose = require('mongoose');

const Restaurant = require('../models/Restaurant');
const MenuItem = require('../models/MenuItem');
const {
  getMenuItems,
  addMenuItem,
  updateMenuItem,
  deleteMenuItem,
} = require('../controllers/menuItems');
const { createUser } = require('./helpers/auth');
const { createMockResponse } = require('./helpers/http');

const buildRestaurant = ({ owner } = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  owner: owner?.id || String(new mongoose.Types.ObjectId()),
  name: 'Menu Route Bistro',
  address: '123 Menu Route',
  telephone: '0212345678',
  openTime: '10:00',
  closeTime: '22:00',
});

const buildMenuItem = ({ restaurantId, overrides = {} } = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  restaurant: restaurantId || new mongoose.Types.ObjectId(),
  name: 'Pad Thai',
  description: 'Classic noodles',
  price: 90,
  category: 'Thai',
  ...overrides,
});

const createMenuFindQuery = (result) => {
  const query = {
    sort: jest.fn().mockResolvedValue(result),
  };

  return query;
};

describe('Restaurant menu item controller requirements', () => {
  it('lists menu items for a restaurant', async () => {
    const restaurant = buildRestaurant();
    const menuItems = [
      buildMenuItem({
        restaurantId: restaurant._id,
        overrides: { name: 'Pad Thai', price: 90 },
      }),
    ];
    const req = { params: { restaurantId: String(restaurant._id) } };
    const res = createMockResponse();
    const query = createMenuFindQuery(menuItems);

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    jest.spyOn(MenuItem, 'find').mockReturnValue(query);

    await getMenuItems(req, res);

    expect(MenuItem.find).toHaveBeenCalledWith({ restaurant: String(restaurant._id) });
    expect(query.sort).toHaveBeenCalledWith('category name');
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
    jest.spyOn(MenuItem, 'find');

    await getMenuItems(req, res);

    expect(MenuItem.find).not.toHaveBeenCalled();
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

  it('handles menu item list query failures', async () => {
    const restaurant = buildRestaurant();
    const req = { params: { restaurantId: String(restaurant._id) } };
    const res = createMockResponse();
    const query = {
      sort: jest.fn().mockRejectedValue(new Error('menu query failed')),
    };

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    jest.spyOn(MenuItem, 'find').mockReturnValue(query);

    await getMenuItems(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.error).toBe('menu query failed');
  });

  it('adds a menu item for the restaurant owner', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = buildRestaurant({ owner });
    const createdMenuItem = buildMenuItem({
      restaurantId: restaurant._id,
      overrides: {
        name: 'Green Curry',
        description: 'Coconut curry',
        price: 120,
        category: 'Thai',
        picture: 'https://example.com/curry.jpg',
      },
    });
    const req = {
      params: { restaurantId: String(restaurant._id) },
      user: owner,
      body: {
        name: 'Green Curry',
        description: 'Coconut curry',
        price: 120,
        category: 'Thai',
        picture: 'https://example.com/curry.jpg',
        restaurant: String(new mongoose.Types.ObjectId()),
      },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    jest.spyOn(Restaurant, 'updateOne').mockResolvedValue({ modifiedCount: 1 });
    jest.spyOn(MenuItem, 'create').mockResolvedValue(createdMenuItem);

    await addMenuItem(req, res);

    expect(MenuItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Green Curry',
        restaurant: restaurant._id,
      })
    );
    expect(Restaurant.updateOne).toHaveBeenCalledWith(
      { _id: restaurant._id },
      { $addToSet: { menu: createdMenuItem._id } }
    );
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
    jest.spyOn(MenuItem, 'create');

    await addMenuItem(req, res);

    expect(MenuItem.create).not.toHaveBeenCalled();
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
    jest.spyOn(MenuItem, 'create');

    await addMenuItem(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toEqual({
      success: false,
      error: 'Not authorized to update this restaurant menu',
    });
    expect(MenuItem.create).not.toHaveBeenCalled();
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
    const validationError = new MenuItem({
      restaurant: restaurant._id,
      price: -1,
    }).validateSync();
    const req = {
      params: { restaurantId: String(restaurant._id) },
      user: owner,
      body: { price: -1 },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    jest.spyOn(MenuItem, 'create').mockRejectedValue(validationError);

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
    const restaurant = buildRestaurant();
    const menuItem = buildMenuItem({
      restaurantId: restaurant._id,
      overrides: { name: 'Old Dish', price: 80 },
    });
    const updatedMenuItem = {
      ...menuItem,
      name: 'Updated Dish',
      price: 95,
    };
    const req = {
      params: {
        restaurantId: String(restaurant._id),
        menuItemId: String(menuItem._id),
      },
      user: admin,
      body: {
        name: 'Updated Dish',
        price: 95,
        restaurant: String(new mongoose.Types.ObjectId()),
      },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    jest.spyOn(MenuItem, 'findOne').mockResolvedValue(menuItem);
    jest.spyOn(MenuItem, 'findByIdAndUpdate').mockResolvedValue(updatedMenuItem);

    await updateMenuItem(req, res);

    expect(MenuItem.findByIdAndUpdate).toHaveBeenCalledWith(
      String(menuItem._id),
      expect.not.objectContaining({ restaurant: expect.anything() }),
      expect.objectContaining({ new: true, runValidators: true })
    );
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
    jest.spyOn(MenuItem, 'findOne');

    await updateMenuItem(req, res);

    expect(MenuItem.findOne).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('blocks menu item updates for another restaurant owner', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const otherOwner = createUser({ role: 'restaurantOwner' });
    const restaurant = buildRestaurant({ owner });
    const menuItem = buildMenuItem({ restaurantId: restaurant._id });
    const req = {
      params: {
        restaurantId: String(restaurant._id),
        menuItemId: String(menuItem._id),
      },
      user: otherOwner,
      body: { name: 'Illegal Update' },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    jest.spyOn(MenuItem, 'findByIdAndUpdate');

    await updateMenuItem(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(MenuItem.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('returns not found when updating a missing menu item', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = buildRestaurant({ owner });
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
    jest.spyOn(MenuItem, 'findOne').mockResolvedValue(null);

    await updateMenuItem(req, res);

    expect(MenuItem.findOne).toHaveBeenCalledWith({
      _id: String(missingMenuItemId),
      restaurant: String(restaurant._id),
    });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body).toEqual({
      success: false,
      error: `Menu item not found with id of ${missingMenuItemId}`,
    });
  });

  it('handles generic menu item update failures', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = buildRestaurant({ owner });
    const menuItem = buildMenuItem({ restaurantId: restaurant._id });
    const req = {
      params: {
        restaurantId: String(restaurant._id),
        menuItemId: String(menuItem._id),
      },
      user: owner,
      body: { name: 'Still Broken' },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    jest.spyOn(MenuItem, 'findOne').mockResolvedValue(menuItem);
    jest.spyOn(MenuItem, 'findByIdAndUpdate').mockRejectedValue(new Error('update failed'));

    await updateMenuItem(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({
      success: false,
      error: 'update failed',
    });
  });

  it('deletes a menu item for the restaurant owner', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = buildRestaurant({ owner });
    const menuItem = buildMenuItem({
      restaurantId: restaurant._id,
      overrides: { name: 'Delete Dish', price: 50 },
    });
    const req = {
      params: {
        restaurantId: String(restaurant._id),
        menuItemId: String(menuItem._id),
      },
      user: owner,
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    jest.spyOn(MenuItem, 'findOne').mockResolvedValue(menuItem);
    jest.spyOn(MenuItem, 'deleteOne').mockResolvedValue({ deletedCount: 1 });
    jest.spyOn(Restaurant, 'updateOne').mockResolvedValue({ modifiedCount: 1 });

    await deleteMenuItem(req, res);

    expect(MenuItem.deleteOne).toHaveBeenCalledWith({ _id: menuItem._id });
    expect(Restaurant.updateOne).toHaveBeenCalledWith(
      { _id: restaurant._id },
      { $pull: { menu: menuItem._id } }
    );
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
    jest.spyOn(MenuItem, 'findOne');

    await deleteMenuItem(req, res);

    expect(MenuItem.findOne).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('blocks menu item deletion for another restaurant owner', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const otherOwner = createUser({ role: 'restaurantOwner' });
    const restaurant = buildRestaurant({ owner });
    const menuItem = buildMenuItem({ restaurantId: restaurant._id });
    const req = {
      params: {
        restaurantId: String(restaurant._id),
        menuItemId: String(menuItem._id),
      },
      user: otherOwner,
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    jest.spyOn(MenuItem, 'deleteOne');

    await deleteMenuItem(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(MenuItem.deleteOne).not.toHaveBeenCalled();
  });

  it('returns not found when deleting a missing menu item', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = buildRestaurant({ owner });
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
    jest.spyOn(MenuItem, 'findOne').mockResolvedValue(null);

    await deleteMenuItem(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body.error).toBe(`Menu item not found with id of ${missingMenuItemId}`);
  });

  it('handles menu item delete failures with a default message', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = buildRestaurant({ owner });
    const menuItem = buildMenuItem({ restaurantId: restaurant._id });
    const req = {
      params: {
        restaurantId: String(restaurant._id),
        menuItemId: String(menuItem._id),
      },
      user: owner,
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    jest.spyOn(MenuItem, 'findOne').mockResolvedValue(menuItem);
    jest.spyOn(MenuItem, 'deleteOne').mockRejectedValue({});

    await deleteMenuItem(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({
      success: false,
      error: 'Unable to process menu item request',
    });
  });
});
