const mongoose = require('mongoose');

const Reservation = require('../models/Reservation');
const Restaurant = require('../models/Restaurant');
const {
  addReservation,
  updateReservation,
  deleteReservation,
} = require('../controllers/reservations');
const { createUser } = require('./helpers/auth');
const { createMockResponse } = require('./helpers/http');

const createOwnedRestaurant = (owner, overrides = {}) => ({
  _id: new mongoose.Types.ObjectId(),
  owner: owner.id,
  name: `Restaurant ${owner.id.slice(-4)}`,
  address: '99 Test Avenue',
  telephone: '0299999999',
  openTime: '10:00',
  closeTime: '22:00',
  ...overrides,
});

const createReservationRecord = ({ user, restaurant, overrides = {} }) => ({
  _id: new mongoose.Types.ObjectId(),
  reservationDate: new Date('2026-05-01T12:00:00.000Z'),
  user: user.id,
  restaurant: restaurant._id,
  createdAt: new Date('2026-04-01T09:00:00.000Z'),
  status: 'waiting',
  reason_reject: '',
  ...overrides,
});

const mockOwnerRestaurantLookup = (owner, restaurantId) => {
  jest.spyOn(Restaurant, 'findById').mockReturnValue({
    select: jest.fn().mockResolvedValue({
      _id: restaurantId,
      owner: owner.id,
    }),
  });
};

describe('Reservation workflow controller requirements', () => {
  it('creates reservations with waiting status by default', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = createOwnedRestaurant(owner);
    const user = createUser();
    const req = {
      params: { restaurantId: String(restaurant._id) },
      user,
      body: {
        reservationDate: '2026-05-01T12:00:00.000Z',
        status: 'approved',
      },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    jest.spyOn(Reservation, 'find').mockResolvedValue([]);
    jest.spyOn(Reservation, 'create').mockImplementation(async (payload) => ({
      _id: new mongoose.Types.ObjectId(),
      ...payload,
    }));

    await addReservation(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('waiting');
    expect(res.body.data.reason_reject).toBe('');
    expect(Reservation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        restaurant: String(restaurant._id),
        user: user.id,
        status: 'waiting',
        reason_reject: '',
      })
    );
  });

  it('allows a restaurant owner to accept a pending reservation and persists the approved status', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = createOwnedRestaurant(owner);
    const user = createUser();
    const reservation = createReservationRecord({
      user,
      restaurant,
      overrides: { status: 'waiting', reason_reject: 'old reason' },
    });
    const req = {
      params: { id: String(reservation._id) },
      user: owner,
      body: {
        status: 'approved',
        reason_reject: 'should be cleared',
      },
    };
    const res = createMockResponse();
    const updatedReservation = {
      ...reservation,
      status: 'approved',
      reason_reject: '',
    };

    jest.spyOn(Reservation, 'findById').mockResolvedValue(reservation);
    mockOwnerRestaurantLookup(owner, restaurant._id);
    jest.spyOn(Reservation, 'findByIdAndUpdate').mockResolvedValue(updatedReservation);

    await updateReservation(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('approved');
    expect(res.body.data.reason_reject).toBe('');
    expect(Reservation.findByIdAndUpdate).toHaveBeenCalledWith(
      String(reservation._id),
      expect.objectContaining({
        status: 'approved',
        reason_reject: '',
      }),
      expect.objectContaining({ new: true, runValidators: true })
    );
  });

  it('allows a restaurant owner to reject a pending reservation with a reason and stores it', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = createOwnedRestaurant(owner);
    const user = createUser();
    const reservation = createReservationRecord({ user, restaurant });
    const req = {
      params: { id: String(reservation._id) },
      user: owner,
      body: {
        status: 'rejected',
        reason_reject: 'Fully booked for that time',
      },
    };
    const res = createMockResponse();
    const updatedReservation = {
      ...reservation,
      status: 'rejected',
      reason_reject: 'Fully booked for that time',
    };

    jest.spyOn(Reservation, 'findById').mockResolvedValue(reservation);
    mockOwnerRestaurantLookup(owner, restaurant._id);
    jest.spyOn(Reservation, 'findByIdAndUpdate').mockResolvedValue(updatedReservation);

    await updateReservation(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('rejected');
    expect(res.body.data.reason_reject).toBe('Fully booked for that time');
    expect(Reservation.findByIdAndUpdate).toHaveBeenCalledWith(
      String(reservation._id),
      expect.objectContaining({
        status: 'rejected',
        reason_reject: 'Fully booked for that time',
      }),
      expect.objectContaining({ new: true, runValidators: true })
    );
  });

  it('rejects reservation rejection without a reason', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = createOwnedRestaurant(owner);
    const user = createUser();
    const reservation = createReservationRecord({ user, restaurant });
    const req = {
      params: { id: String(reservation._id) },
      user: owner,
      body: {
        status: 'rejected',
        reason_reject: '   ',
      },
    };
    const res = createMockResponse();

    jest.spyOn(Reservation, 'findById').mockResolvedValue(reservation);
    mockOwnerRestaurantLookup(owner, restaurant._id);

    await updateReservation(req, res);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe(
      'Please provide a rejection reason when rejecting a reservation'
    );
  });

  it('returns a cancellation-specific message when the reservation is already missing', async () => {
    const user = createUser();
    const req = {
      params: { id: '507f1f77bcf86cd799439011' },
      user,
    };
    const res = createMockResponse();

    jest.spyOn(Reservation, 'findById').mockResolvedValue(null);

    await deleteReservation(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe(
      'Reservation has already been cancelled or does not exist'
    );
  });

  it('returns a cancellation permission error when another user tries to cancel the reservation', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = createOwnedRestaurant(owner);
    const reservationOwner = createUser();
    const otherUser = createUser();
    const reservation = createReservationRecord({ user: reservationOwner, restaurant });
    const req = {
      params: { id: String(reservation._id) },
      user: otherUser,
    };
    const res = createMockResponse();

    jest.spyOn(Reservation, 'findById').mockResolvedValue(reservation);
    jest.spyOn(Restaurant, 'findById').mockReturnValue({
      select: jest.fn().mockResolvedValue({
        _id: restaurant._id,
        owner: owner.id,
      }),
    });

    await deleteReservation(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe(
      'You do not have permission to cancel this reservation'
    );
  });
});
