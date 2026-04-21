const mongoose = require('mongoose');

const Reservation = require('../models/Reservation');
const Restaurant = require('../models/Restaurant');
const {
  getReservations,
  getReservation,
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

const createReservationQuery = (result) => {
  const query = {
    populate: jest.fn(() => query),
    then: (resolve) => Promise.resolve(resolve(result)),
  };

  return query;
};

describe('Reservation workflow controller requirements', () => {
  it('lists only the current user reservations for normal users', async () => {
    const user = createUser();
    const reservations = [{ _id: new mongoose.Types.ObjectId(), user: user.id }];
    const query = createReservationQuery(reservations);
    const req = { user, params: {} };
    const res = createMockResponse();

    jest.spyOn(Reservation, 'find').mockReturnValue(query);

    await getReservations(req, res);

    expect(Reservation.find).toHaveBeenCalledWith({ user: user.id });
    expect(query.populate).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({
      success: true,
      count: 1,
      data: reservations,
    });
  });

  it('lists owner reservations for one owned restaurant', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurantId = new mongoose.Types.ObjectId();
    const reservations = [{ _id: new mongoose.Types.ObjectId(), restaurant: restaurantId }];
    const query = createReservationQuery(reservations);
    const req = { user: owner, params: { restaurantId: String(restaurantId) } };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findOne').mockReturnValue({
      select: jest.fn().mockResolvedValue({ _id: restaurantId }),
    });
    jest.spyOn(Reservation, 'find').mockReturnValue(query);

    await getReservations(req, res);

    expect(Reservation.find).toHaveBeenCalledWith({ restaurant: String(restaurantId) });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('blocks owners from listing reservations for restaurants they do not own', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurantId = new mongoose.Types.ObjectId();
    const req = { user: owner, params: { restaurantId: String(restaurantId) } };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findOne').mockReturnValue({
      select: jest.fn().mockResolvedValue(null),
    });

    await getReservations(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body.message).toBe(
      `User ${owner.id} is not authorized to access reservations for this restaurant`
    );
  });

  it('lists owner reservations across owned restaurants', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurantIds = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
    const restaurantsQuery = {
      select: jest.fn().mockResolvedValue(restaurantIds.map((_id) => ({ _id }))),
    };
    const reservations = [{ _id: new mongoose.Types.ObjectId(), restaurant: restaurantIds[0] }];
    const query = createReservationQuery(reservations);
    const req = { user: owner, params: {} };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'find').mockReturnValue(restaurantsQuery);
    jest.spyOn(Reservation, 'find').mockReturnValue(query);

    await getReservations(req, res);

    expect(Reservation.find).toHaveBeenCalledWith({
      restaurant: { $in: restaurantIds },
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('lists admin reservations for one restaurant', async () => {
    const admin = createUser({ role: 'admin' });
    const restaurantId = new mongoose.Types.ObjectId();
    const reservations = [{ _id: new mongoose.Types.ObjectId(), restaurant: restaurantId }];
    const query = createReservationQuery(reservations);
    const req = { user: admin, params: { restaurantId: String(restaurantId) } };
    const res = createMockResponse();

    jest.spyOn(Reservation, 'find').mockReturnValue(query);

    await getReservations(req, res);

    expect(Reservation.find).toHaveBeenCalledWith({ restaurant: String(restaurantId) });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('lists all reservations for admins', async () => {
    const admin = createUser({ role: 'admin' });
    const reservations = [{ _id: new mongoose.Types.ObjectId() }];
    const query = createReservationQuery(reservations);
    const req = { user: admin, params: {} };
    const res = createMockResponse();

    jest.spyOn(Reservation, 'find').mockReturnValue(query);

    await getReservations(req, res);

    expect(Reservation.find).toHaveBeenCalledWith();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('handles reservation list failures', async () => {
    const user = createUser();
    const query = {
      populate: jest.fn(() => query),
      then: (resolve, reject) => reject(new Error('list failed')),
    };
    const req = { user, params: {} };
    const res = createMockResponse();

    jest.spyOn(Reservation, 'find').mockReturnValue(query);

    await getReservations(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body).toEqual({ success: false, message: 'Cannot find Reservation' });
  });

  it('gets a single reservation for an admin', async () => {
    const admin = createUser({ role: 'admin' });
    const restaurant = createOwnedRestaurant(createUser({ role: 'restaurantOwner' }));
    const user = createUser();
    const reservation = createReservationRecord({ user, restaurant });
    const req = { user: admin, params: { id: String(reservation._id) } };
    const res = createMockResponse();

    jest.spyOn(Reservation, 'findById').mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        ...reservation,
        restaurant,
      }),
    });

    await getReservation(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.success).toBe(true);
  });

  it('gets a single reservation for its owner', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = createOwnedRestaurant(owner);
    const user = createUser();
    const reservation = createReservationRecord({ user, restaurant });
    const req = { user, params: { id: String(reservation._id) } };
    const res = createMockResponse();

    jest.spyOn(Reservation, 'findById').mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        ...reservation,
        restaurant,
      }),
    });

    await getReservation(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.data.user).toBe(user.id);
  });

  it('gets a single reservation for the restaurant owner', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = createOwnedRestaurant(owner);
    const user = createUser();
    const reservation = createReservationRecord({ user, restaurant });
    const req = { user: owner, params: { id: String(reservation._id) } };
    const res = createMockResponse();

    jest.spyOn(Reservation, 'findById').mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        ...reservation,
        restaurant,
      }),
    });

    await getReservation(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.data.restaurant.owner).toBe(owner.id);
  });

  it('returns not found for a missing reservation detail', async () => {
    const user = createUser();
    const id = new mongoose.Types.ObjectId();
    const req = { user, params: { id: String(id) } };
    const res = createMockResponse();

    jest.spyOn(Reservation, 'findById').mockReturnValue({
      populate: jest.fn().mockResolvedValue(null),
    });

    await getReservation(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body.message).toBe(`No reservation with the id of ${id}`);
  });

  it('blocks unauthorized reservation detail access', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = createOwnedRestaurant(owner);
    const reservationOwner = createUser();
    const otherUser = createUser();
    const reservation = createReservationRecord({ user: reservationOwner, restaurant });
    const req = { user: otherUser, params: { id: String(reservation._id) } };
    const res = createMockResponse();

    jest.spyOn(Reservation, 'findById').mockReturnValue({
      populate: jest.fn().mockResolvedValue({
        ...reservation,
        restaurant,
      }),
    });

    await getReservation(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body.message).toBe(
      `User ${otherUser.id} is not authorized to access this reservation`
    );
  });

  it('handles reservation detail lookup failures', async () => {
    const user = createUser();
    const req = { user, params: { id: String(new mongoose.Types.ObjectId()) } };
    const res = createMockResponse();

    jest.spyOn(Reservation, 'findById').mockReturnValue({
      populate: jest.fn().mockRejectedValue(new Error('detail failed')),
    });

    await getReservation(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body).toEqual({ success: false, message: 'Cannot find Reservation' });
  });

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

  it('returns not found when creating a reservation for a missing restaurant', async () => {
    const user = createUser();
    const restaurantId = new mongoose.Types.ObjectId();
    const req = {
      params: { restaurantId: String(restaurantId) },
      user,
      body: {
        reservationDate: '2026-05-01T12:00:00.000Z',
      },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(null);

    await addReservation(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body.message).toBe(`No restaurant with the id of ${restaurantId}`);
  });

  it('blocks non-admin users after three reservations', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = createOwnedRestaurant(owner);
    const user = createUser();
    const req = {
      params: { restaurantId: String(restaurant._id) },
      user,
      body: {
        reservationDate: '2026-05-01T12:00:00.000Z',
      },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    jest.spyOn(Reservation, 'find').mockResolvedValue([{}, {}, {}]);

    await addReservation(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.message).toBe(`The user with ID ${user.id} has already made 3 reservations`);
  });

  it('allows admins to create reservations past the user reservation limit', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = createOwnedRestaurant(owner);
    const admin = createUser({ role: 'admin' });
    const req = {
      params: { restaurantId: String(restaurant._id) },
      user: admin,
      body: {
        reservationDate: '2026-05-01T12:00:00.000Z',
      },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    jest.spyOn(Reservation, 'find').mockResolvedValue([{}, {}, {}]);
    jest.spyOn(Reservation, 'create').mockImplementation(async (payload) => ({
      _id: new mongoose.Types.ObjectId(),
      ...payload,
    }));

    await addReservation(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('handles reservation creation failures', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = createOwnedRestaurant(owner);
    const user = createUser();
    const req = {
      params: { restaurantId: String(restaurant._id) },
      user,
      body: {
        reservationDate: '2026-05-01T12:00:00.000Z',
      },
    };
    const res = createMockResponse();

    jest.spyOn(Restaurant, 'findById').mockResolvedValue(restaurant);
    jest.spyOn(Reservation, 'find').mockResolvedValue([]);
    jest.spyOn(Reservation, 'create').mockRejectedValue(new Error('create failed'));

    await addReservation(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body).toEqual({ success: false, message: 'Cannot create Reservation' });
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

  it('allows an admin to update any reservation status', async () => {
    const admin = createUser({ role: 'admin' });
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = createOwnedRestaurant(owner);
    const user = createUser();
    const reservation = createReservationRecord({ user, restaurant });
    const req = {
      params: { id: String(reservation._id) },
      user: admin,
      body: { status: 'approved' },
    };
    const res = createMockResponse();
    const updatedReservation = {
      ...reservation,
      status: 'approved',
      reason_reject: '',
    };

    jest.spyOn(Reservation, 'findById').mockResolvedValue(reservation);
    jest.spyOn(Reservation, 'findByIdAndUpdate').mockResolvedValue(updatedReservation);

    await updateReservation(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.data.status).toBe('approved');
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

  it('returns not found when updating a missing reservation', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const id = new mongoose.Types.ObjectId();
    const req = {
      params: { id: String(id) },
      user: owner,
      body: { status: 'approved' },
    };
    const res = createMockResponse();

    jest.spyOn(Reservation, 'findById').mockResolvedValue(null);

    await updateReservation(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.body.message).toBe(`No reservation with the id of ${id}`);
  });

  it('blocks unauthorized reservation updates', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = createOwnedRestaurant(owner);
    const reservationOwner = createUser();
    const otherUser = createUser();
    const reservation = createReservationRecord({ user: reservationOwner, restaurant });
    const req = {
      params: { id: String(reservation._id) },
      user: otherUser,
      body: { status: 'approved' },
    };
    const res = createMockResponse();

    jest.spyOn(Reservation, 'findById').mockResolvedValue(reservation);
    jest.spyOn(Restaurant, 'findById').mockReturnValue({
      select: jest.fn().mockResolvedValue({
        _id: restaurant._id,
        owner: owner.id,
      }),
    });

    await updateReservation(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body.message).toBe(`User ${otherUser.id} is not authorized to update this reservation`);
  });

  it('blocks reservation updates when no user is present', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = createOwnedRestaurant(owner);
    const user = createUser();
    const reservation = createReservationRecord({ user, restaurant });
    const req = {
      params: { id: String(reservation._id) },
      body: { status: 'approved' },
    };
    const res = createMockResponse();

    jest.spyOn(Reservation, 'findById').mockResolvedValue(reservation);

    await updateReservation(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body.message).toBe('Cannot update Reservation');
  });

  it('lets normal users update reservation date but not status or rejection reason', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = createOwnedRestaurant(owner);
    const user = createUser();
    const reservation = createReservationRecord({ user, restaurant });
    const req = {
      params: { id: String(reservation._id) },
      user,
      body: {
        reservationDate: '2026-05-02T12:00:00.000Z',
        status: 'approved',
        reason_reject: 'not allowed',
      },
    };
    const res = createMockResponse();
    const updatedReservation = {
      ...reservation,
      reservationDate: new Date('2026-05-02T12:00:00.000Z'),
    };

    jest.spyOn(Reservation, 'findById').mockResolvedValue(reservation);
    jest.spyOn(Reservation, 'findByIdAndUpdate').mockResolvedValue(updatedReservation);

    await updateReservation(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(Reservation.findByIdAndUpdate).toHaveBeenCalledWith(
      String(reservation._id),
      expect.not.objectContaining({
        status: expect.anything(),
        reason_reject: expect.anything(),
      }),
      expect.objectContaining({ new: true, runValidators: true })
    );
  });

  it('prevents restaurant owners from changing reservation date while updating status', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = createOwnedRestaurant(owner);
    const user = createUser();
    const reservation = createReservationRecord({ user, restaurant });
    const req = {
      params: { id: String(reservation._id) },
      user: owner,
      body: {
        reservationDate: '2026-05-02T12:00:00.000Z',
        status: 'approved',
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

    expect(Reservation.findByIdAndUpdate).toHaveBeenCalledWith(
      String(reservation._id),
      expect.not.objectContaining({ reservationDate: expect.anything() }),
      expect.objectContaining({ new: true, runValidators: true })
    );
  });

  it('handles reservation update failures', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = createOwnedRestaurant(owner);
    const user = createUser();
    const reservation = createReservationRecord({ user, restaurant });
    const req = {
      params: { id: String(reservation._id) },
      user: owner,
      body: { status: 'approved' },
    };
    const res = createMockResponse();

    jest.spyOn(Reservation, 'findById').mockResolvedValue(reservation);
    mockOwnerRestaurantLookup(owner, restaurant._id);
    jest.spyOn(Reservation, 'findByIdAndUpdate').mockRejectedValue(new Error('update failed'));

    await updateReservation(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body).toEqual({ success: false, message: 'Cannot update Reservation' });
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

  it('cancels a reservation successfully', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = createOwnedRestaurant(owner);
    const user = createUser();
    const reservation = createReservationRecord({ user, restaurant });
    reservation.deleteOne = jest.fn().mockResolvedValue({ deletedCount: 1 });
    const req = {
      params: { id: String(reservation._id) },
      user,
    };
    const res = createMockResponse();

    jest.spyOn(Reservation, 'findById').mockResolvedValue(reservation);

    await deleteReservation(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.message).toBe('Reservation cancelled successfully');
    expect(reservation.deleteOne).toHaveBeenCalled();
  });

  it('handles reservation cancellation failures', async () => {
    const owner = createUser({ role: 'restaurantOwner' });
    const restaurant = createOwnedRestaurant(owner);
    const user = createUser();
    const reservation = createReservationRecord({ user, restaurant });
    reservation.deleteOne = jest.fn().mockRejectedValue(new Error('delete failed'));
    const req = {
      params: { id: String(reservation._id) },
      user,
    };
    const res = createMockResponse();

    jest.spyOn(Reservation, 'findById').mockResolvedValue(reservation);

    await deleteReservation(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.body).toEqual({
      success: false,
      message: 'Unable to cancel reservation right now',
    });
  });
});
