const mongoose = require('mongoose');

const Restaurant = require('../models/Restaurant');
const Menu = require('../models/Menu');
const {
  getMenus,
  getMenu,
  addMenu,
  addMenus,
  saveMenus,
  updateMenu,
  deleteMenu,
} = require('../controllers/menus');
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

const buildMenu = ({ restaurantId, overrides = {} } = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  restaurant: restaurantId || new mongoose.Types.ObjectId(),
  title: 'Main Menu',
  description: 'Daily dishes',
  items: [
    {
      _id: new mongoose.Types.ObjectId(),
      name: 'Pad Thai',
      description: 'Classic noodles',
      price: 90,
      category: 'Thai',
      picture: 'https://example.com/pad-thai.jpg',
    },
  ],
  ...overrides,
});

const createMenuListQuery = (result) => {
  const query = {
    sort: jest.fn().mockResolvedValue(result),
  };

  return query;
};

describe('Restaurant menu controller requirements', () => {
  it('lists menus for a restaurant', async () => {
    const restaurant = buildRestaurant();
    const menus = [
      buildMenu({
        restaurantId: restaurant._id,
        overrides: { title: 'Main Menu' },
      }),
    ];
    const req = { params: { restaurantId: String(restaurant._id) } };
    const res = createMockResponse();
    const query = createMenuListQuery(menus);

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    jest.spyOn(Menu, 'find').mockReturnValue(query);

    await getMenus(req, res);

    expect(Menu.find).toHaveBeenCalledWith({ restaurant: String(restaurant._id) });
    expect(query.sort).toHaveBeenCalledWith('createdAt title');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({
      success: true,
      count: 1,
      data: menus,
    });
  });

  it('returns not found when listing menus for a missing restaurant', async () => {
    const restaurantId = new mongoose.Types.ObjectId();
    const req = { params: { restaurantId: String(restaurantId) } };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(null);
    jest.spyOn(Menu, 'find');

    await getMenus(req, res);

    expect(Menu.find).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body).toEqual({
      success: false,
      error: `Restaurant not found with id of ${restaurantId}`,
    });
  });

  it('handles menu list failures', async () => {
    const req = { params: { restaurantId: String(new mongoose.Types.ObjectId()) } };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockRejectedValue(new Error('list failed'));

    await getMenus(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({
      success: false,
      error: 'list failed',
    });
  });

  it('gets a single menu for a restaurant', async () => {
    const restaurant = buildRestaurant();
    const menu = buildMenu({ restaurantId: restaurant._id });
    const req = {
      params: {
        restaurantId: String(restaurant._id),
        menuId: String(menu._id),
      },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    jest.spyOn(Menu, 'findOne').mockResolvedValue(menu);

    await getMenu(req, res);

    expect(Menu.findOne).toHaveBeenCalledWith({
      _id: String(menu._id),
      restaurant: String(restaurant._id),
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({
      success: true,
      data: menu,
    });
  });

  it('returns not found when a menu does not exist', async () => {
    const restaurant = buildRestaurant();
    const menuId = new mongoose.Types.ObjectId();
    const req = {
      params: {
        restaurantId: String(restaurant._id),
        menuId: String(menuId),
      },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    jest.spyOn(Menu, 'findOne').mockResolvedValue(null);

    await getMenu(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body).toEqual({
      success: false,
      error: `Menu not found with id of ${menuId}`,
    });
  });

  it('returns not found when fetching a menu for a missing restaurant', async () => {
    const restaurantId = new mongoose.Types.ObjectId();
    const menuId = new mongoose.Types.ObjectId();
    const req = {
      params: {
        restaurantId: String(restaurantId),
        menuId: String(menuId),
      },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(null);
    jest.spyOn(Menu, 'findOne');

    await getMenu(req, res);

    expect(Menu.findOne).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body).toEqual({
      success: false,
      error: `Restaurant not found with id of ${restaurantId}`,
    });
  });

  it('handles single menu lookup failures', async () => {
    const restaurant = buildRestaurant();
    const menuId = new mongoose.Types.ObjectId();
    const req = {
      params: {
        restaurantId: String(restaurant._id),
        menuId: String(menuId),
      },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    jest.spyOn(Menu, 'findOne').mockRejectedValue(new Error('lookup failed'));

    await getMenu(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({
      success: false,
      error: 'lookup failed',
    });
  });

  it('adds a menu for the restaurant owner and sanitizes the payload', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = buildRestaurant({ owner });
    const createdMenu = buildMenu({
      restaurantId: restaurant._id,
      overrides: {
        title: 'Dinner Menu',
        description: 'Signature dishes',
      },
    });
    const req = {
      params: { restaurantId: String(restaurant._id) },
      user: owner,
      body: {
        _id: new mongoose.Types.ObjectId(),
        id: String(new mongoose.Types.ObjectId()),
        restaurant: String(new mongoose.Types.ObjectId()),
        title: 'Dinner Menu',
        description: 'Signature dishes',
        items: [
          {
            name: 'Green Curry',
            description: 'Coconut curry',
            price: 120,
            category: 'Thai',
          },
        ],
      },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    jest.spyOn(Menu, 'create').mockResolvedValue(createdMenu);
    jest.spyOn(Restaurant, 'updateOne').mockResolvedValue({ modifiedCount: 1 });

    await addMenu(req, res);

    expect(Menu.create).toHaveBeenCalledWith({
      title: 'Dinner Menu',
      description: 'Signature dishes',
      items: [
        {
          name: 'Green Curry',
          description: 'Coconut curry',
          price: 120,
          category: 'Thai',
        },
      ],
      restaurant: restaurant._id,
    });
    expect(Restaurant.updateOne).toHaveBeenCalledWith(
      { _id: restaurant._id },
      { $addToSet: { menus: createdMenu._id } }
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.body.message).toBe('Menu created successfully');
    expect(res.body.data).toBe(createdMenu);
  });

  it('allows admins to add menus for any restaurant', async () => {
    const admin = createUser({ role: 'admin' });
    const restaurant = buildRestaurant();
    const createdMenu = buildMenu({ restaurantId: restaurant._id });
    const req = {
      params: { restaurantId: String(restaurant._id) },
      user: admin,
      body: {
        title: 'Admin Menu',
        items: [],
      },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    jest.spyOn(Menu, 'create').mockResolvedValue(createdMenu);
    jest.spyOn(Restaurant, 'updateOne').mockResolvedValue({ modifiedCount: 1 });

    await addMenu(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('returns not found when adding a menu to a missing restaurant', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurantId = new mongoose.Types.ObjectId();
    const req = {
      params: { restaurantId: String(restaurantId) },
      user: owner,
      body: { title: 'Missing Menu' },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(null);
    jest.spyOn(Menu, 'create');

    await addMenu(req, res);

    expect(Menu.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('blocks menu creation for another restaurant owner', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const otherOwner = createUser({ role: 'restaurantOwner' });
    const restaurant = buildRestaurant({ owner });
    const req = {
      params: { restaurantId: String(restaurant._id) },
      user: otherOwner,
      body: { title: 'Illegal Menu' },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    jest.spyOn(Menu, 'create');

    await addMenu(req, res);

    expect(Menu.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toEqual({
      success: false,
      error: 'Not authorized to update this restaurant menus',
    });
  });

  it('blocks menu creation when no user is present', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = buildRestaurant({ owner });
    const req = {
      params: { restaurantId: String(restaurant._id) },
      body: { title: 'Anonymous Menu' },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    jest.spyOn(Menu, 'create');

    await addMenu(req, res);

    expect(Menu.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('validates mandatory menu fields when adding a menu', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = buildRestaurant({ owner });
    const validationError = new Menu({
      restaurant: restaurant._id,
      items: [{ price: -1 }],
    }).validateSync();
    const req = {
      params: { restaurantId: String(restaurant._id) },
      user: owner,
      body: { items: [{ price: -1 }] },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    jest.spyOn(Menu, 'create').mockRejectedValue(validationError);

    await addMenu(req, res);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toEqual(
      expect.arrayContaining([
        'Please add a menu title',
        'Item price must be greater than or equal to 0',
      ])
    );
  });

  it('adds multiple menus in one request', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = buildRestaurant({ owner });
    const createdMenus = [
      buildMenu({
        restaurantId: restaurant._id,
        overrides: { title: 'Brunch Menu' },
      }),
      buildMenu({
        restaurantId: restaurant._id,
        overrides: { title: 'Dessert Menu' },
      }),
    ];
    const req = {
      params: { restaurantId: String(restaurant._id) },
      user: owner,
      body: {
        menus: [
          {
            _id: new mongoose.Types.ObjectId(),
            id: String(new mongoose.Types.ObjectId()),
            restaurant: String(new mongoose.Types.ObjectId()),
            title: 'Brunch Menu',
            items: [{ name: 'Pancake', price: 180 }],
          },
          {
            title: 'Dessert Menu',
            description: 'Sweet dishes',
            items: [{ name: 'Mango Sticky Rice', price: 120 }],
          },
        ],
      },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    jest.spyOn(Menu, 'insertMany').mockResolvedValue(createdMenus);
    jest.spyOn(Restaurant, 'updateOne').mockResolvedValue({ modifiedCount: 1 });

    await addMenus(req, res);

    expect(Menu.insertMany).toHaveBeenCalledWith(
      [
        {
          title: 'Brunch Menu',
          items: [{ name: 'Pancake', price: 180 }],
          restaurant: restaurant._id,
        },
        {
          title: 'Dessert Menu',
          description: 'Sweet dishes',
          items: [{ name: 'Mango Sticky Rice', price: 120 }],
          restaurant: restaurant._id,
        },
      ],
      { ordered: true }
    );
    expect(Restaurant.updateOne).toHaveBeenCalledWith(
      { _id: restaurant._id },
      {
        $addToSet: {
          menus: { $each: createdMenus.map((menu) => menu._id) },
        },
      }
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.body).toEqual({
      success: true,
      message: 'Menus created successfully',
      count: 2,
      data: createdMenus,
    });
  });

  it('requires at least one menu when adding multiple menus', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = buildRestaurant({ owner });
    const req = {
      params: { restaurantId: String(restaurant._id) },
      user: owner,
      body: { menus: [] },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    jest.spyOn(Menu, 'insertMany');

    await addMenus(req, res);

    expect(Menu.insertMany).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.body).toEqual({
      success: false,
      error: ['Please add at least one menu'],
    });
  });

  it('returns not found when bulk adding menus to a missing restaurant', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurantId = new mongoose.Types.ObjectId();
    const req = {
      params: { restaurantId: String(restaurantId) },
      user: owner,
      body: { menus: [{ title: 'Missing Menu' }] },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(null);
    jest.spyOn(Menu, 'insertMany');

    await addMenus(req, res);

    expect(Menu.insertMany).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('blocks bulk menu creation for another restaurant owner', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const otherOwner = createUser({ role: 'restaurantOwner' });
    const restaurant = buildRestaurant({ owner });
    const req = {
      params: { restaurantId: String(restaurant._id) },
      user: otherOwner,
      body: { menus: [{ title: 'Illegal Menu' }] },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    jest.spyOn(Menu, 'insertMany');

    await addMenus(req, res);

    expect(Menu.insertMany).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('handles bulk menu creation failures', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = buildRestaurant({ owner });
    const req = {
      params: { restaurantId: String(restaurant._id) },
      user: owner,
      body: { menus: [{ title: 'Broken Menu' }] },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    jest.spyOn(Menu, 'insertMany').mockRejectedValue(new Error('bulk failed'));

    await addMenus(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({
      success: false,
      error: 'bulk failed',
    });
  });

  it('falls back to a default error message when a bulk menu error has no message', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = buildRestaurant({ owner });
    const req = {
      params: { restaurantId: String(restaurant._id) },
      user: owner,
      body: { menus: [{ title: 'Broken Menu' }] },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    jest.spyOn(Menu, 'insertMany').mockRejectedValue({});

    await addMenus(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({
      success: false,
      error: 'Unable to process menu request',
    });
  });

  it('saves menus by updating existing menus and creating new ones', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = buildRestaurant({ owner });
    const existingMenu = buildMenu({
      restaurantId: restaurant._id,
      overrides: { title: 'Lunch Menu' },
    });
    const updatedMenu = {
      ...existingMenu,
      title: 'Updated Lunch Menu',
      description: 'Updated description',
    };
    const createdMenu = buildMenu({
      restaurantId: restaurant._id,
      overrides: { title: 'Dinner Menu' },
    });
    const req = {
      params: { restaurantId: String(restaurant._id) },
      user: owner,
      body: {
        menus: [
          {
            _id: String(existingMenu._id),
            title: 'Updated Lunch Menu',
            description: 'Updated description',
            restaurant: String(new mongoose.Types.ObjectId()),
          },
          {
            title: 'Dinner Menu',
            description: 'Evening dishes',
            items: [{ name: 'Steak', price: 420 }],
          },
        ],
      },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    jest.spyOn(Menu, 'findOneAndUpdate').mockResolvedValue(updatedMenu);
    jest.spyOn(Menu, 'insertMany').mockResolvedValue([createdMenu]);
    jest.spyOn(Restaurant, 'updateOne').mockResolvedValue({ modifiedCount: 1 });

    await saveMenus(req, res);

    expect(Menu.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: String(existingMenu._id),
        restaurant: restaurant._id,
      },
      {
        title: 'Updated Lunch Menu',
        description: 'Updated description',
      },
      {
        new: true,
        runValidators: true,
      }
    );
    expect(Menu.insertMany).toHaveBeenCalledWith(
      [
        {
          title: 'Dinner Menu',
          description: 'Evening dishes',
          items: [{ name: 'Steak', price: 420 }],
          restaurant: restaurant._id,
        },
      ],
      { ordered: true }
    );
    expect(Restaurant.updateOne).toHaveBeenCalledWith(
      { _id: restaurant._id },
      {
        $addToSet: {
          menus: { $each: [updatedMenu._id, createdMenu._id] },
        },
      }
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({
      success: true,
      message: 'Menus saved successfully',
      createdCount: 1,
      updatedCount: 1,
      count: 2,
      data: [updatedMenu, createdMenu],
    });
  });

  it('saves menus using the id field when there are no new menus to create', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = buildRestaurant({ owner });
    const existingMenu = buildMenu({
      restaurantId: restaurant._id,
      overrides: { title: 'Dessert Menu' },
    });
    const req = {
      params: { restaurantId: String(restaurant._id) },
      user: owner,
      body: {
        menus: [
          {
            id: String(existingMenu._id),
            title: 'Dessert Menu',
            items: [{ name: 'Cake', price: 150 }],
          },
        ],
      },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    jest.spyOn(Menu, 'findOneAndUpdate').mockResolvedValue(existingMenu);
    jest.spyOn(Menu, 'insertMany');
    jest.spyOn(Restaurant, 'updateOne').mockResolvedValue({ modifiedCount: 1 });

    await saveMenus(req, res);

    expect(Menu.insertMany).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.createdCount).toBe(0);
    expect(res.body.updatedCount).toBe(1);
  });

  it('requires at least one menu when saving menus in bulk', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = buildRestaurant({ owner });
    const req = {
      params: { restaurantId: String(restaurant._id) },
      user: owner,
      body: { menus: [] },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    jest.spyOn(Menu, 'insertMany');

    await saveMenus(req, res);

    expect(Menu.insertMany).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(422);
  });

  it('returns not found when saving menus for a missing restaurant', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurantId = new mongoose.Types.ObjectId();
    const req = {
      params: { restaurantId: String(restaurantId) },
      user: owner,
      body: { menus: [{ title: 'Missing Menu' }] },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(null);
    jest.spyOn(Menu, 'insertMany');

    await saveMenus(req, res);

    expect(Menu.insertMany).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('blocks bulk menu saves for another restaurant owner', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const otherOwner = createUser({ role: 'restaurantOwner' });
    const restaurant = buildRestaurant({ owner });
    const req = {
      params: { restaurantId: String(restaurant._id) },
      user: otherOwner,
      body: { menus: [{ title: 'Illegal Menu' }] },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    jest.spyOn(Menu, 'insertMany');

    await saveMenus(req, res);

    expect(Menu.insertMany).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns not found when a menu update target is missing during save', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = buildRestaurant({ owner });
    const missingMenuId = new mongoose.Types.ObjectId();
    const req = {
      params: { restaurantId: String(restaurant._id) },
      user: owner,
      body: {
        menus: [
          {
            _id: String(missingMenuId),
            title: 'Missing Menu',
          },
        ],
      },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    jest.spyOn(Menu, 'findOneAndUpdate').mockResolvedValue(null);
    jest.spyOn(Menu, 'insertMany');

    await saveMenus(req, res);

    expect(Menu.insertMany).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body).toEqual({
      success: false,
      error: `Menu not found with id of ${missingMenuId}`,
    });
  });

  it('handles bulk menu save failures', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = buildRestaurant({ owner });
    const req = {
      params: { restaurantId: String(restaurant._id) },
      user: owner,
      body: {
        menus: [{ title: 'Broken Menu' }],
      },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    jest.spyOn(Menu, 'insertMany').mockRejectedValue(new Error('save failed'));

    await saveMenus(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({
      success: false,
      error: 'save failed',
    });
  });

  it('updates a single menu and sanitizes the payload', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = buildRestaurant({ owner });
    const menu = buildMenu({
      restaurantId: restaurant._id,
      overrides: { title: 'Updated Menu' },
    });
    const req = {
      params: {
        restaurantId: String(restaurant._id),
        menuId: String(menu._id),
      },
      user: owner,
      body: {
        _id: String(new mongoose.Types.ObjectId()),
        id: String(new mongoose.Types.ObjectId()),
        restaurant: String(new mongoose.Types.ObjectId()),
        title: 'Updated Menu',
        description: 'Updated description',
        items: [{ name: 'Soup', price: 80 }],
      },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    jest.spyOn(Menu, 'findOneAndUpdate').mockResolvedValue(menu);

    await updateMenu(req, res);

    expect(Menu.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: String(menu._id),
        restaurant: String(restaurant._id),
      },
      {
        title: 'Updated Menu',
        description: 'Updated description',
        items: [{ name: 'Soup', price: 80 }],
      },
      {
        new: true,
        runValidators: true,
      }
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({
      success: true,
      message: 'Menu updated successfully',
      data: menu,
    });
  });

  it('returns not found when updating a menu for a missing restaurant', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurantId = new mongoose.Types.ObjectId();
    const menuId = new mongoose.Types.ObjectId();
    const req = {
      params: {
        restaurantId: String(restaurantId),
        menuId: String(menuId),
      },
      user: owner,
      body: { title: 'Missing Menu' },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(null);
    jest.spyOn(Menu, 'findOneAndUpdate');

    await updateMenu(req, res);

    expect(Menu.findOneAndUpdate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('blocks menu updates for another restaurant owner', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const otherOwner = createUser({ role: 'restaurantOwner' });
    const restaurant = buildRestaurant({ owner });
    const menuId = new mongoose.Types.ObjectId();
    const req = {
      params: {
        restaurantId: String(restaurant._id),
        menuId: String(menuId),
      },
      user: otherOwner,
      body: { title: 'Illegal Menu' },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    jest.spyOn(Menu, 'findOneAndUpdate');

    await updateMenu(req, res);

    expect(Menu.findOneAndUpdate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns not found when updating a missing menu', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = buildRestaurant({ owner });
    const menuId = new mongoose.Types.ObjectId();
    const req = {
      params: {
        restaurantId: String(restaurant._id),
        menuId: String(menuId),
      },
      user: owner,
      body: { title: 'Missing Menu' },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    jest.spyOn(Menu, 'findOneAndUpdate').mockResolvedValue(null);

    await updateMenu(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body).toEqual({
      success: false,
      error: `Menu not found with id of ${menuId}`,
    });
  });

  it('validates menu updates', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = buildRestaurant({ owner });
    const menuId = new mongoose.Types.ObjectId();
    const validationError = new Menu({
      restaurant: restaurant._id,
      title: 'Valid title',
      items: [{ name: 'Soup', price: -10 }],
    }).validateSync();
    const req = {
      params: {
        restaurantId: String(restaurant._id),
        menuId: String(menuId),
      },
      user: owner,
      body: { title: 'Valid title', items: [{ name: 'Soup', price: -10 }] },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    jest.spyOn(Menu, 'findOneAndUpdate').mockRejectedValue(validationError);

    await updateMenu(req, res);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toEqual(
      expect.arrayContaining(['Item price must be greater than or equal to 0'])
    );
  });

  it('deletes a menu and removes its restaurant reference', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = buildRestaurant({ owner });
    const menu = buildMenu({ restaurantId: restaurant._id });
    const req = {
      params: {
        restaurantId: String(restaurant._id),
        menuId: String(menu._id),
      },
      user: owner,
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    jest.spyOn(Menu, 'findOne').mockResolvedValue(menu);
    jest.spyOn(Menu, 'deleteOne').mockResolvedValue({ deletedCount: 1 });
    jest.spyOn(Restaurant, 'updateOne').mockResolvedValue({ modifiedCount: 1 });

    await deleteMenu(req, res);

    expect(Menu.deleteOne).toHaveBeenCalledWith({ _id: menu._id });
    expect(Restaurant.updateOne).toHaveBeenCalledWith(
      { _id: restaurant._id },
      { $pull: { menus: menu._id } }
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({
      success: true,
      message: 'Menu deleted successfully',
      data: {},
    });
  });

  it('returns not found when deleting a menu for a missing restaurant', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurantId = new mongoose.Types.ObjectId();
    const menuId = new mongoose.Types.ObjectId();
    const req = {
      params: {
        restaurantId: String(restaurantId),
        menuId: String(menuId),
      },
      user: owner,
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(null);
    jest.spyOn(Menu, 'findOne');

    await deleteMenu(req, res);

    expect(Menu.findOne).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('blocks menu deletion for another restaurant owner', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const otherOwner = createUser({ role: 'restaurantOwner' });
    const restaurant = buildRestaurant({ owner });
    const menuId = new mongoose.Types.ObjectId();
    const req = {
      params: {
        restaurantId: String(restaurant._id),
        menuId: String(menuId),
      },
      user: otherOwner,
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    jest.spyOn(Menu, 'findOne');

    await deleteMenu(req, res);

    expect(Menu.findOne).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns not found when deleting a missing menu', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = buildRestaurant({ owner });
    const menuId = new mongoose.Types.ObjectId();
    const req = {
      params: {
        restaurantId: String(restaurant._id),
        menuId: String(menuId),
      },
      user: owner,
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    jest.spyOn(Menu, 'findOne').mockResolvedValue(null);

    await deleteMenu(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body).toEqual({
      success: false,
      error: `Menu not found with id of ${menuId}`,
    });
  });

  it('handles menu deletion failures', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = buildRestaurant({ owner });
    const menu = buildMenu({ restaurantId: restaurant._id });
    const req = {
      params: {
        restaurantId: String(restaurant._id),
        menuId: String(menu._id),
      },
      user: owner,
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    jest.spyOn(Menu, 'findOne').mockResolvedValue(menu);
    jest.spyOn(Menu, 'deleteOne').mockRejectedValue(new Error('delete failed'));

    await deleteMenu(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({
      success: false,
      error: 'delete failed',
    });
  });
});
