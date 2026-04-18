const Reservation = require('../models/Reservation');
const Restaurant = require('../models/Restaurant');

//@desc     Get all reservations
//@route    GET /api/v1/reservations
//@access   Public
exports.getReservations = async (req, res, next) => {
    let query;
    //General users can see only their reservations!
    if (req.user.role !== 'admin') {
        query = Reservation.find({ user: req.user.id }).populate({
            path: 'restaurant',
            select: 'name address telephone openTime closeTime picture'
        }).populate({
                path: 'user',
                select: 'name email telephone'
            });
    } else { //If you are an admin, you can see all!
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
            select: 'name address telephone openTime closeTime'
        });

        if (!reservation) {
            return res.status(404).json({ success: false, message: `No reservation with the id of ${req.params.id}` });
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

        if (reservation.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({ success: false, message: `User ${req.user.id} is not authorized to update this reservation` });
        }

        const updatePayload = {
            ...req.body
        };

        delete updatePayload.user;
        delete updatePayload.restaurant;

        if (req.user.role !== 'admin') {
            delete updatePayload.status;
            delete updatePayload.reason_reject;
        } else if (updatePayload.status !== 'rejected') {
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
            return res.status(404).json({ success: false, message: `No reservation with the id of ${req.params.id}` });
        }

        if (reservation.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({ success: false, message: `User ${req.user.id} is not authorized to delete this reservation` });
        }

        await reservation.deleteOne();

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ success: false, message: "Cannot delete Reservation" });
    }
};
