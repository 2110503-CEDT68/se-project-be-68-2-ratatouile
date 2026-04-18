const Reservation = require('../models/Reservation');
const Restaurant = require('../models/Restaurant');

const getOwnedRestaurantIds = async (userId) => {
    const restaurants = await Restaurant.find({ owner: userId }).select('_id');
    return restaurants.map((restaurant) => restaurant._id);
};

const canManageReservation = async (reservation, user) => {
    if (!reservation || !user) {
        return false;
    }

    if (user.role === 'admin') {
        return true;
    }

    if (reservation.user.toString() === user.id) {
        return true;
    }

    if (user.role !== 'restaurantOwner') {
        return false;
    }

    const restaurant = await Restaurant.findById(reservation.restaurant).select('owner');
    return restaurant?.owner?.toString() === user.id;
};

//@desc     Get all reservations
//@route    GET /api/v1/reservations
//@access   Public
exports.getReservations = async (req, res, next) => {
    let query;
    // General users can see only their reservations.
    if (req.user.role === 'user') {
        query = Reservation.find({ user: req.user.id }).populate({
            path: 'restaurant',
            select: 'name address telephone openTime closeTime picture'
        }).populate({
                path: 'user',
                select: 'name email telephone'
            });
    } else if (req.user.role === 'restaurantOwner') {
        if (req.params.restaurantId) {
            const restaurant = await Restaurant.findOne({
                _id: req.params.restaurantId,
                owner: req.user.id
            }).select('_id');

            if (!restaurant) {
                return res.status(403).json({
                    success: false,
                    message: `User ${req.user.id} is not authorized to access reservations for this restaurant`
                });
            }

            query = Reservation.find({ restaurant: req.params.restaurantId }).populate({
                path: 'restaurant',
                select: 'name address telephone openTime closeTime picture'
            }).populate({
                path: 'user',
                select: 'name email telephone'
            });
        } else {
            const ownedRestaurantIds = await getOwnedRestaurantIds(req.user.id);

            query = Reservation.find({ restaurant: { $in: ownedRestaurantIds } }).populate({
                path: 'restaurant',
                select: 'name address telephone openTime closeTime picture'
            }).populate({
                path: 'user',
                select: 'name email telephone'
            });
        }
    } else { // If you are an admin, you can see all.
        if (req.params.restaurantId) {
            console.log(req.params.restaurantId);
            query = Reservation.find({ restaurant: req.params.restaurantId }).populate({
                path: 'restaurant',
                select: 'name address telephone openTime closeTime picture'
            }).populate({
                path: 'user',
                select: 'name email telephone'
            });
        } else {
            query = Reservation.find().populate({
                path: 'restaurant',
                select: 'name address telephone openTime closeTime picture'
            }).populate({
                path: 'user',
                select: 'name email telephone'
            });
        }
    }

    try {
        const reservations = await query;
        res.status(200).json({
            success: true,
            count: reservations.length,
            data: reservations
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Cannot find Reservation" });
    }
};

//@desc     Get single reservation
//@route    GET /api/v1/reservations/:id
//@access   Public
exports.getReservation = async (req, res, next) => {
    try {
        const reservation = await Reservation.findById(req.params.id).populate({
            path: 'restaurant',
            select: 'name address telephone openTime closeTime owner'
        });

        if (!reservation) {
            return res.status(404).json({ success: false, message: `No reservation with the id of ${req.params.id}` });
        }

        const canAccessReservation =
            req.user.role === 'admin' ||
            reservation.user.toString() === req.user.id ||
            (req.user.role === 'restaurantOwner' && reservation.restaurant?.owner?.toString() === req.user.id);

        if (!canAccessReservation) {
            return res.status(403).json({
                success: false,
                message: `User ${req.user.id} is not authorized to access this reservation`
            });
        }

        res.status(200).json({
            success: true,
            data: reservation
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Cannot find Reservation" });
    }
};

//@desc     Add reservation
//@route    POST /api/v1/restaurants/:restaurantId/reservation
//@access   Private
exports.addReservation = async (req, res, next) => {
    try {
        const reservationPayload = {
            ...req.body,
            restaurant: req.params.restaurantId,
            user: req.user.id,
            status: 'waiting',
            reason_reject: ''
        };

        const restaurant = await Restaurant.findById(req.params.restaurantId);

        if (!restaurant) {
            return res.status(404).json({ success: false, message: `No restaurant with the id of ${req.params.restaurantId}` });
        }

        //Check for existed reservations
        const existedReservations = await Reservation.find({ user: req.user.id });

        //If the user is not an admin, they can only create 3 reservations.
        if (existedReservations.length >= 3 && req.user.role !== 'admin') {
            return res.status(400).json({ success: false, message: `The user with ID ${req.user.id} has already made 3 reservations` });
        }

        const reservation = await Reservation.create(reservationPayload);

        res.status(201).json({
            success: true,
            data: reservation
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Cannot create Reservation" });
    }
};

//@desc     Update reservation
//@route    PUT /api/v1/reservations/:id
//@access   Private
exports.updateReservation = async (req, res, next) => {
    try {
        let reservation = await Reservation.findById(req.params.id);

        if (!reservation) {
            return res.status(404).json({ success: false, message: `No reservation with the id of ${req.params.id}` });
        }

        if (!(await canManageReservation(reservation, req.user))) {
            return res.status(403).json({ success: false, message: `User ${req.user.id} is not authorized to update this reservation` });
        }

        const updatePayload = {
            ...req.body
        };

        delete updatePayload.user;
        delete updatePayload.restaurant;

        if (req.user.role === 'user') {
            delete updatePayload.status;
            delete updatePayload.reason_reject;
        }

        if (req.user.role === 'restaurantOwner') {
            delete updatePayload.reservationDate;
        }

        if ((req.user.role === 'admin' || req.user.role === 'restaurantOwner') && updatePayload.status !== 'rejected') {
            updatePayload.reason_reject = '';
        }

        reservation = await Reservation.findByIdAndUpdate(req.params.id, updatePayload, {
            new: true,
            runValidators: true
        });

        res.status(200).json({
            success: true,
            data: reservation
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Cannot update Reservation" });
    }
};

//@desc     Delete reservation
//@route    DELETE /api/v1/reservations/:id
//@access   Private
exports.deleteReservation = async (req, res, next) => {
    try {
        const reservation = await Reservation.findById(req.params.id);

        if (!reservation) {
            return res.status(404).json({
                success: false,
                message: 'Reservation has already been cancelled or does not exist'
            });
        }

        if (!(await canManageReservation(reservation, req.user))) {
            return res.status(403).json({
                success: false,
                message: 'You do not have permission to cancel this reservation'
            });
        }

        await reservation.deleteOne();

        res.status(200).json({
            success: true,
            message: 'Reservation cancelled successfully',
            data: {}
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: 'Unable to cancel reservation right now'
        });
    }
};
