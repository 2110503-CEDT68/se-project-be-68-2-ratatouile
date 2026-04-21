const mongoose = require('mongoose');

const Restaurant = require('../models/Restaurant');
const Reservation = require('../models/Reservation');
const MenuItem = require('../models/MenuItem');
const {
  getRestaurants,
  getRestaurant,
  createRestaurant,
  updateRestaurant,
  deleteRestaurant,
} = require('../controllers/restaurants');
const { createUser } = require('./helpers/auth');
const { createMockResponse } = require('./helpers/http');

const createRestaurantQuery = (result) => {
  const query = {
    populate: jest.fn(() => query),
    select: jest.fn(() => query),
    sort: jest.fn(() => query),
    skip: jest.fn(() => query),
    limit: jest.fn(() => query),
    then: (resolve) => Promise.resolve(resolve(result)),
  };

  return query;
};

const createRestaurantLookupQuery = (result, shouldReject = false) => {
  const query = {
    populate: jest.fn(() => query),
    then: (resolve, reject) =>
      shouldReject
        ? Promise.reject(result).then(resolve, reject)
        : Promise.resolve(result).then(resolve, reject),
  };

  return query;
};

describe('Restaurant profile controller requirements', () => {
  it('lists restaurants with filtering, select, sort, and pagination', async () => {
    const restaurants = [{ _id: new mongoose.Types.ObjectId(), name: 'Listed Bistro' }];
    const query = createRestaurantQuery(restaurants);
    const req = {
      query: {
        select: 'name,address',
        sort: 'name',
        page: '2',
        limit: '1',
        rating: 'gte:4',
      },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'find').mockReturnValue(query);
    jest.spyOn(Restaurant, 'countDocuments').mockResolvedValue(3);

    await getRestaurants(req, res);

    expect(Restaurant.find).toHaveBeenCalledWith({ rating: '$gte:4' });
    expect(query.populate).toHaveBeenCalledWith('reservations');
    expect(query.populate).toHaveBeenCalledWith('menu');
    expect(query.select).toHaveBeenCalledWith('name address');
    expect(query.sort).toHaveBeenCalledWith('name');
    expect(query.skip).toHaveBeenCalledWith(1);
    expect(query.limit).toHaveBeenCalledWith(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({
      success: true,
      count: 1,
      data: restaurants,
    });
  });

  it('lists restaurants with default sort and first page defaults', async () => {
    const restaurants = [{ _id: new mongoose.Types.ObjectId(), name: 'Default Bistro' }];
    const query = createRestaurantQuery(restaurants);
    const req = { query: {} };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'find').mockReturnValue(query);
    jest.spyOn(Restaurant, 'countDocuments').mockResolvedValue(1);

    await getRestaurants(req, res);

    expect(query.sort).toHaveBeenCalledWith('-createdAt');
    expect(query.skip).toHaveBeenCalledWith(0);
    expect(query.limit).toHaveBeenCalledWith(25);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('handles restaurant list query failures', async () => {
    const query = createRestaurantQuery([]);
    const req = { query: {} };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'find').mockReturnValue(query);
    jest.spyOn(Restaurant, 'countDocuments').mockRejectedValue(new Error('count failed'));

    await getRestaurants(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({ success: false });
  });

  it('gets a single restaurant by id', async () => {
    const restaurant = { _id: new mongoose.Types.ObjectId(), name: 'Single Bistro' };
    const req = { params: { id: String(restaurant._id) } };
    const res = createMockResponse();
    const query = createRestaurantLookupQuery(restaurant);

    jest.spyOn(Restaurant, 'findById').mockReturnValue(query);

    await getRestaurant(req, res);

    expect(query.populate).toHaveBeenCalledWith('reservations');
    expect(query.populate).toHaveBeenCalledWith('menu');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({ success: true, data: restaurant });
  });

  it('returns false when a single restaurant is missing', async () => {
    const req = { params: { id: String(new mongoose.Types.ObjectId()) } };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockReturnValue(createRestaurantLookupQuery(null));

    await getRestaurant(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({ success: false });
  });

  it('handles single restaurant lookup failures', async () => {
    const req = { params: { id: String(new mongoose.Types.ObjectId()) } };
    const res = createMockResponse();

    jest
      .spyOn(Restaurant, 'findById')
      .mockReturnValue(createRestaurantLookupQuery(new Error('lookup failed'), true));

    await getRestaurant(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({ success: false });
  });

  it('creates a restaurant profile and assigns the authenticated owner', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const createdRestaurant = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Test Bistro',
      address: '123 Test Street',
      telephone: '0212345678',
      openTime: '10:00',
      closeTime: '22:00',
      owner: owner.id,
    };
    const req = {
      user: owner,
      body: {
        name: 'Test Bistro',
        address: '123 Test Street',
        telephone: '0212345678',
        openTime: '10:00',
        closeTime: '22:00',
        owner: '000000000000000000000000',
      },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findOne').mockResolvedValue(null);
    jest.spyOn(Restaurant, 'create').mockResolvedValue(createdRestaurant);

    await createRestaurant(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Restaurant profile created successfully');
    expect(res.body.data.owner).toBe(owner.id);
    expect(Restaurant.create).toHaveBeenCalledWith(
      expect.objectContaining({ owner: owner.id })
    );
  });

  it('allows admins to create restaurant profiles without owner duplicate check', async () => {
    const admin = createUser({ role: 'admin' });
    const createdRestaurant = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Admin Bistro',
      owner: admin.id,
    };
    const req = {
      user: admin,
      body: {
        name: 'Admin Bistro',
        address: '123 Admin Street',
        telephone: '0212345678',
        openTime: '10:00',
        closeTime: '22:00',
      },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findOne');
    jest.spyOn(Restaurant, 'create').mockResolvedValue(createdRestaurant);

    await createRestaurant(req, res);

    expect(Restaurant.findOne).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('rejects duplicate restaurant creation for the same restaurant owner', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const req = {
      user: owner,
      body: {
        name: 'Second Place',
        address: '2 Main Street',
        telephone: '0222222222',
        openTime: '10:00',
        closeTime: '21:00',
      },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findOne').mockResolvedValue({
      _id: new mongoose.Types.ObjectId(),
      owner: owner.id,
    });

    await createRestaurant(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('Restaurant owner already has a restaurant profile');
  });

  it('maps duplicate restaurant creation errors to conflict responses', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const req = {
      user: owner,
      body: {
        name: 'Duplicate Bistro',
        address: '2 Main Street',
        telephone: '0222222222',
        openTime: '10:00',
        closeTime: '21:00',
      },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findOne').mockResolvedValue(null);
    jest.spyOn(Restaurant, 'create').mockRejectedValue({
      code: 11000,
      keyPattern: { name: 1 },
    });

    await createRestaurant(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.body).toEqual({ success: false, error: 'name already exists' });
  });

  it('maps duplicate restaurant errors without a field to a generic field message', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const req = {
      user: owner,
      body: {
        name: 'Duplicate Bistro',
        address: '2 Main Street',
        telephone: '0222222222',
        openTime: '10:00',
        closeTime: '21:00',
      },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findOne').mockResolvedValue(null);
    jest.spyOn(Restaurant, 'create').mockRejectedValue({
      code: 11000,
    });

    await createRestaurant(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.body).toEqual({ success: false, error: 'field already exists' });
  });

  it('validates mandatory restaurant details', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const req = {
      user: owner,
      body: {
        name: 'Broken Restaurant',
        telephone: 'abc',
        openTime: '25:00',
      },
    };
    const res = createMockResponse();
    const validationError = new Restaurant({
      name: 'Broken Restaurant',
      telephone: 'abc',
      openTime: '25:00',
    }).validateSync();

    jest.spyOn(Restaurant, 'findOne').mockResolvedValue(null);
    jest.spyOn(Restaurant, 'create').mockRejectedValue(validationError);

    await createRestaurant(req, res);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toEqual(
      expect.arrayContaining([
        'Please add an address',
        'Please add a valid telephone number',
        'Please add a valid open time in HH:mm format',
        'Please add a close time (e.g., 22:00)',
      ])
    );
  });

  it('updates restaurant profile details and prevents owner reassignment', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurantId = new mongoose.Types.ObjectId();
    const existingRestaurant = {
      _id: restaurantId,
      owner: owner.id,
      name: 'Old Bistro',
    };
    const updatedRestaurant = {
      ...existingRestaurant,
      name: 'Updated Bistro',
      address: '456 Updated Road',
      telephone: '0298765432',
      openTime: '09:00',
      closeTime: '21:00',
    };
    const req = {
      params: { id: String(restaurantId) },
      user: owner,
      body: {
        name: 'Updated Bistro',
        address: '456 Updated Road',
        telephone: '0298765432',
        openTime: '09:00',
        closeTime: '21:00',
        owner: '000000000000000000000000',
      },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(existingRestaurant);
    jest.spyOn(Restaurant, 'findByIdAndUpdate').mockResolvedValue(updatedRestaurant);

    await updateRestaurant(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Restaurant profile updated successfully');
    expect(res.body.data.name).toBe('Updated Bistro');
    expect(Restaurant.findByIdAndUpdate).toHaveBeenCalledWith(
      String(restaurantId),
      expect.not.objectContaining({ owner: expect.anything() }),
      expect.objectContaining({ new: true, runValidators: true })
    );
  });

  it('returns not found when updating a missing restaurant profile', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurantId = new mongoose.Types.ObjectId();
    const req = {
      params: { id: String(restaurantId) },
      user: owner,
      body: { name: 'Missing Bistro' },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(null);

    await updateRestaurant(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body).toEqual({
      success: false,
      error: `Restaurant not found with id of ${restaurantId}`,
    });
  });

  it('blocks unauthorized restaurant profile updates', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const otherOwner = createUser({ role: 'restaurantOwner' });
    const restaurantId = new mongoose.Types.ObjectId();
    const req = {
      params: { id: String(restaurantId) },
      user: otherOwner,
      body: { name: 'Illegal Update' },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue({
      _id: restaurantId,
      owner: owner.id,
    });

    await updateRestaurant(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toEqual({
      success: false,
      error: 'Not authorized to update this restaurant profile',
    });
  });

  it('blocks restaurant profile updates when no user is present', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurantId = new mongoose.Types.ObjectId();
    const req = {
      params: { id: String(restaurantId) },
      body: { name: 'Illegal Update' },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue({
      _id: restaurantId,
      owner: owner.id,
    });

    await updateRestaurant(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('maps generic restaurant update errors to bad request responses', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurantId = new mongoose.Types.ObjectId();
    const req = {
      params: { id: String(restaurantId) },
      user: owner,
      body: { name: 'Broken Update' },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue({
      _id: restaurantId,
      owner: owner.id,
    });
    jest.spyOn(Restaurant, 'findByIdAndUpdate').mockRejectedValue(new Error('update failed'));

    await updateRestaurant(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({
      success: false,
      error: 'update failed',
    });
  });

  it('prevents saving blank mandatory fields when updating restaurant profile', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurantId = new mongoose.Types.ObjectId();
    const existingRestaurant = {
      _id: restaurantId,
      owner: owner.id,
      name: 'Editable Bistro',
    };
    const validationError = new Restaurant({
      name: '',
      address: '',
      telephone: '',
      openTime: '',
      closeTime: '',
    }).validateSync();
    const req = {
      params: { id: String(restaurantId) },
      user: owner,
      body: {
        name: '',
        address: '',
        telephone: '',
        openTime: '',
        closeTime: '',
      },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(existingRestaurant);
    jest.spyOn(Restaurant, 'findByIdAndUpdate').mockRejectedValue(validationError);

    await updateRestaurant(req, res);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toEqual(
      expect.arrayContaining([
        'Please add a name',
        'Please add an address',
        'Please add a telephone number',
        'Please add an open time (e.g., 10:00)',
        'Please add a close time (e.g., 22:00)',
      ])
    );
  });

  it('blocks deleting a restaurant with active reservations', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurantId = new mongoose.Types.ObjectId();
    const existingRestaurant = {
      _id: restaurantId,
      owner: owner.id,
      name: 'Busy Bistro',
    };
    const req = {
      params: { id: String(restaurantId) },
      user: owner,
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(existingRestaurant);
    jest.spyOn(Reservation, 'find').mockResolvedValue([
      {
        _id: new mongoose.Types.ObjectId(),
        restaurant: restaurantId,
        status: 'waiting',
      },
    ]);

    await deleteRestaurant(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe(
      'Cannot delete restaurant with 1 active (waiting or approved) reservations. Please handle them first.'
    );
  });

  it('returns not found when deleting a missing restaurant profile', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurantId = new mongoose.Types.ObjectId();
    const req = {
      params: { id: String(restaurantId) },
      user: owner,
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(null);

    await deleteRestaurant(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body).toEqual({
      success: false,
      error: `Restaurant not found with id of ${restaurantId}`,
    });
  });

  it('blocks unauthorized restaurant profile deletes', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const otherOwner = createUser({ role: 'restaurantOwner' });
    const restaurantId = new mongoose.Types.ObjectId();
    const req = {
      params: { id: String(restaurantId) },
      user: otherOwner,
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue({
      _id: restaurantId,
      owner: owner.id,
    });

    await deleteRestaurant(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toEqual({
      success: false,
      error: 'Not authorized to delete this restaurant profile',
    });
  });

  it('maps generic restaurant delete errors to bad request responses', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurantId = new mongoose.Types.ObjectId();
    const req = {
      params: { id: String(restaurantId) },
      user: owner,
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue({
      _id: restaurantId,
      owner: owner.id,
    });
    jest.spyOn(Reservation, 'find').mockRejectedValue(new Error());

    await deleteRestaurant(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body).toEqual({
      success: false,
      error: 'Unable to process restaurant request',
    });
  });

  it('removes a restaurant profile when there are no active reservations', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurantId = new mongoose.Types.ObjectId();
    const existingRestaurant = {
      _id: restaurantId,
      owner: owner.id,
      name: 'Removable Bistro',
    };
    const req = {
      params: { id: String(restaurantId) },
      user: owner,
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(existingRestaurant);
    jest.spyOn(Reservation, 'find').mockResolvedValue([]);
    jest.spyOn(Reservation, 'deleteMany').mockResolvedValue({ deletedCount: 2 });
    jest.spyOn(MenuItem, 'deleteMany').mockResolvedValue({ deletedCount: 3 });
    jest.spyOn(Restaurant, 'deleteOne').mockResolvedValue({ deletedCount: 1 });

    await deleteRestaurant(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Restaurant profile deleted successfully');
    expect(Reservation.deleteMany).toHaveBeenCalledWith({ restaurant: String(restaurantId) });
    expect(MenuItem.deleteMany).toHaveBeenCalledWith({ restaurant: String(restaurantId) });
    expect(Restaurant.deleteOne).toHaveBeenCalledWith({ _id: String(restaurantId) });
  });
});
