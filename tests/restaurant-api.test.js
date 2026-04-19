const mongoose = require('mongoose');

const Restaurant = require('../models/Restaurant');
const Reservation = require('../models/Reservation');
const {
  createRestaurant,
  updateRestaurant,
  deleteRestaurant,
} = require('../controllers/restaurants');
const { createUser } = require('./helpers/auth');
const { createMockResponse } = require('./helpers/http');

describe('Restaurant profile controller requirements', () => {
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
    jest.spyOn(Restaurant, 'deleteOne').mockResolvedValue({ deletedCount: 1 });

    await deleteRestaurant(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Restaurant profile deleted successfully');
    expect(Reservation.deleteMany).toHaveBeenCalledWith({ restaurant: String(restaurantId) });
    expect(Restaurant.deleteOne).toHaveBeenCalledWith({ _id: String(restaurantId) });
  });
});
