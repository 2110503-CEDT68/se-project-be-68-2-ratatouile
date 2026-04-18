const mongoose = require('mongoose');

const Restaurant = require('../models/Restaurant');
const { createRestaurant } = require('../controllers/restaurants');
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
});
