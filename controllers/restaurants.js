//@desc   Get all restaurants
//@route  Get /api/v1/restaurants
//@access Public
const Restaurant = require("../models/Restaurant");
const Reservation = require('../models/Reservation');
const Menu = require('../models/Menu');

const buildRestaurantErrorResponse = (err) => {
  if (err && err.code === 11000) {
    const duplicatedField = Object.keys(err.keyPattern || {})[0] || 'field';
    return {
      statusCode: 409,
      body: {
        success: false,
        error: `${duplicatedField} already exists`
      }
    };
  }

  if (err && err.name === 'ValidationError') {
    return {
      statusCode: 422,
      body: {
        success: false,
        error: Object.values(err.errors).map((validationError) => validationError.message)
      }
    };
  }

  return {
    statusCode: 400,
    body: {
      success: false,
      error: err.message || 'Unable to process restaurant request'
    }
  };
};

const canManageRestaurant = (restaurant, user) => {
  if (!restaurant || !user) {
    return false;
  }

  return (
    user.role === 'admin' ||
    restaurant.owner?.toString() === user.id
  );
};

exports.getRestaurants = async (req, res, next) => {
  let query;

  // Copy req.query
  const reqQuery = { ...req.query };

  // Fields to exclude
  const removeFields = ["select", "sort", "page", "limit"];

  // Loop over remove fields and delete them from reqQuery
  removeFields.forEach((param) => delete reqQuery[param]);

  console.log(reqQuery);

  let queryStr = JSON.stringify(reqQuery);

  queryStr = queryStr.replace(
    /\b(gt|gte|lt|lte|in)\b/g,
    (match) => `$${match}`,
  );
  query = Restaurant.find(JSON.parse(queryStr)).populate('reservations').populate({
    path: 'reviews',
    populate: {
      path: 'user',
      select: 'name'
    }
  }).populate('menus')
  // Select Fields
  if (req.query.select) {
    const fields = req.query.select.split(",").join(" ");
    query = query.select(fields);
  }

  // Sort
  if (req.query.sort) {
    const sortBy = req.query.sort.split(",").join(" ");
    query = query.sort(sortBy);
  } else {
    query = query.sort("-createdAt");
  }

  // Pagination
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 25;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;

  try {
    const total = await Restaurant.countDocuments();
    query = query.skip(startIndex).limit(limit);
    // Execute query
    const restaurants = await query;
// Pagination result
const pagination = {};

if (endIndex < total) {
  pagination.next = {
    page: page + 1,
    limit
  };
}

if (startIndex > 0) {
  pagination.prev = {
    page: page - 1,
    limit
  };
}
    res.status(200).json({
      success: true,
      count: restaurants.length,
      data: restaurants,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
    });
  }
};

//@desc   Get single restaurant
//@route  Get /api/v1/restaurants/:id
//@access Public

exports.getRestaurant = async (req, res, next) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id)
      .populate('reservations')
      .populate({
        path: 'reviews',
        populate: {
          path: 'user',
          select: 'name'
        }
      })
      .populate('menus');

    if (!restaurant) {
      return res.status(400).json({ success: false });
    }

    res.status(200).json({
      success: true,
      data: restaurant,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
    });
  }
};

//@desc   Create a restaurant
//@route  POST /api/v1/restaurants
//@access Private

exports.createRestaurant = async (req, res, next) => {
  try {
    const restaurantPayload = {
      ...req.body,
      owner: req.user.id
    };

    if (req.user.role === 'restaurantOwner') {
      const existingRestaurant = await Restaurant.findOne({ owner: req.user.id });

      if (existingRestaurant) {
        return res.status(409).json({
          success: false,
          error: 'Restaurant owner already has a restaurant profile'
        });
      }
    }

    const restaurant = await Restaurant.create(restaurantPayload);

    res.status(201).json({
      success: true,
      message: 'Restaurant profile created successfully',
      data: restaurant
    });
  } catch (err) {
    const errorResponse = buildRestaurantErrorResponse(err);
    console.error(err);
    res.status(errorResponse.statusCode).json(errorResponse.body);
  }
};

//@desc   Update single restaurant
//@route  PUT /api/v1/restaurants/:id
//@access Private

exports.updateRestaurant = async (req, res, next) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        error: `Restaurant not found with id of ${req.params.id}`
      });
    }

    if (!canManageRestaurant(restaurant, req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to update this restaurant profile'
      });
    }

    const restaurantPayload = {
      ...req.body
    };

    delete restaurantPayload.owner;

    const updatedRestaurant = await Restaurant.findByIdAndUpdate(req.params.id, restaurantPayload, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      message: 'Restaurant profile updated successfully',
      data: updatedRestaurant,
    });
  } catch (err) {
    const errorResponse = buildRestaurantErrorResponse(err);
    res.status(errorResponse.statusCode).json(errorResponse.body);
  }
};

//@desc   Delete single restaurant
//@route  DELETE /api/v1/restaurants/:id
//@access Private

exports.deleteRestaurant = async (req, res, next) => {
  try {
    const restaurant = await Restaurant.findById(req.params.id);

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        error: `Restaurant not found with id of ${req.params.id}`
      });
    }

    if (!canManageRestaurant(restaurant, req.user)) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this restaurant profile'
      });
    }

    // Check for active (waiting or approved) reservations
    const activeReservations = await Reservation.find({
      restaurant: req.params.id,
      status: { $in: ['waiting', 'approved'] }
    });

    if (activeReservations.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete restaurant with ${activeReservations.length} active (waiting or approved) reservations. Please handle them first.`
      });
    }

    await Reservation.deleteMany({restaurant: req.params.id});
    await Menu.deleteMany({restaurant: req.params.id});
    await Restaurant.deleteOne({_id: req.params.id});

    res.status(200).json({
      success: true,
      message: 'Restaurant profile deleted successfully',
      data: {},
    });
  } catch (err) {
    const errorResponse = buildRestaurantErrorResponse(err);
    res.status(errorResponse.statusCode).json(errorResponse.body);
  }
};
