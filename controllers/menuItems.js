const Restaurant = require("../models/Restaurant");
const MenuItem = require("../models/MenuItem");

const buildMenuErrorResponse = (err) => {
  if (err && err.name === "ValidationError") {
    return {
      statusCode: 422,
      body: {
        success: false,
        error: Object.values(err.errors).map(
          (validationError) => validationError.message,
        ),
      },
    };
  }

  return {
    statusCode: 400,
    body: {
      success: false,
      error: err.message || "Unable to process menu item request",
    },
  };
};

const canManageRestaurant = (restaurant, user) => {
  if (!restaurant || !user) {
    return false;
  }

  return user.role === "admin" || restaurant.owner?.toString() === user.id;
};

const getRestaurantOr404 = async (restaurantId, res) => {
  const restaurant = await Restaurant.findById(restaurantId);

  if (!restaurant) {
    res.status(404).json({
      success: false,
      error: `Restaurant not found with id of ${restaurantId}`,
    });
    return null;
  }

  return restaurant;
};

const buildMenuItemPayload = (payload) => {
  const { _id, id, restaurant, ...menuItemPayload } = payload;

  return menuItemPayload;
};

const getMenuItemId = (payload) => payload._id || payload.id;

//@desc   Get all menu items for a restaurant
//@route  GET /api/v1/restaurants/:restaurantId/menu
//@access Public
exports.getMenuItems = async (req, res, next) => {
  try {
    const restaurant = await getRestaurantOr404(req.params.restaurantId, res);

    if (!restaurant) {
      return;
    }

    const menuItems = await MenuItem.find({
      restaurant: req.params.restaurantId,
    }).sort("category name");

    res.status(200).json({
      success: true,
      count: menuItems.length,
      data: menuItems,
    });
  } catch (err) {
    const errorResponse = buildMenuErrorResponse(err);
    res.status(errorResponse.statusCode).json(errorResponse.body);
  }
};

//@desc   Add a menu item to a restaurant
//@route  POST /api/v1/restaurants/:restaurantId/menu
//@access Private
exports.addMenuItem = async (req, res, next) => {
  try {
    const restaurant = await getRestaurantOr404(req.params.restaurantId, res);

    if (!restaurant) {
      return;
    }

    if (!canManageRestaurant(restaurant, req.user)) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to update this restaurant menu",
      });
    }

    const menuItem = await MenuItem.create({
      ...buildMenuItemPayload(req.body),
      restaurant: restaurant._id,
    });

    await Restaurant.updateOne(
      { _id: restaurant._id },
      { $addToSet: { menu: menuItem._id } },
    );

    res.status(201).json({
      success: true,
      message: "Menu item added successfully",
      data: menuItem,
    });
  } catch (err) {
    const errorResponse = buildMenuErrorResponse(err);
    res.status(errorResponse.statusCode).json(errorResponse.body);
  }
};

//@desc   Add multiple menu items to a restaurant
//@route  POST /api/v1/restaurants/:restaurantId/menu/bulk
//@access Private
exports.addMenuItems = async (req, res, next) => {
  try {
    const restaurant = await getRestaurantOr404(req.params.restaurantId, res);

    if (!restaurant) {
      return;
    }

    if (!canManageRestaurant(restaurant, req.user)) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to update this restaurant menu",
      });
    }

    const items = req.body.items;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(422).json({
        success: false,
        error: ["Please add at least one menu item"],
      });
    }

    const menuItems = await MenuItem.insertMany(
      items.map((item) => ({
        ...buildMenuItemPayload(item),
        restaurant: restaurant._id,
      })),
      { ordered: true },
    );

    await Restaurant.updateOne(
      { _id: restaurant._id },
      {
        $addToSet: {
          menu: { $each: menuItems.map((menuItem) => menuItem._id) },
        },
      },
    );

    res.status(201).json({
      success: true,
      message: "Menu items added successfully",
      count: menuItems.length,
      data: menuItems,
    });
  } catch (err) {
    const errorResponse = buildMenuErrorResponse(err);
    res.status(errorResponse.statusCode).json(errorResponse.body);
  }
};

//@desc   Save multiple menu items by creating new items and updating existing items
//@route  PUT /api/v1/restaurants/:restaurantId/menu/bulk
//@access Private
exports.saveMenuItems = async (req, res, next) => {
  try {
    const restaurant = await getRestaurantOr404(req.params.restaurantId, res);

    if (!restaurant) {
      return;
    }

    if (!canManageRestaurant(restaurant, req.user)) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to update this restaurant menu",
      });
    }

    const items = req.body.items;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(422).json({
        success: false,
        error: ["Please add at least one menu item"],
      });
    }

    const itemsToCreate = items.filter((item) => !getMenuItemId(item));
    const itemsToUpdate = items.filter((item) => getMenuItemId(item));
    const updatedMenuItems = [];

    for (const item of itemsToUpdate) {
      const menuItemId = getMenuItemId(item);
      const updatedMenuItem = await MenuItem.findOneAndUpdate(
        {
          _id: menuItemId,
          restaurant: restaurant._id,
        },
        buildMenuItemPayload(item),
        {
          new: true,
          runValidators: true,
        },
      );

      if (!updatedMenuItem) {
        return res.status(404).json({
          success: false,
          error: `Menu item not found with id of ${menuItemId}`,
        });
      }

      updatedMenuItems.push(updatedMenuItem);
    }

    const createdMenuItems =
      itemsToCreate.length > 0
        ? await MenuItem.insertMany(
            itemsToCreate.map((item) => ({
              ...buildMenuItemPayload(item),
              restaurant: restaurant._id,
            })),
            { ordered: true },
          )
        : [];
    const savedMenuItems = [...updatedMenuItems, ...createdMenuItems];

    await Restaurant.updateOne(
      { _id: restaurant._id },
      {
        $addToSet: {
          menu: { $each: savedMenuItems.map((menuItem) => menuItem._id) },
        },
      },
    );

    res.status(200).json({
      success: true,
      message: "Menu items saved successfully",
      createdCount: createdMenuItems.length,
      updatedCount: updatedMenuItems.length,
      count: savedMenuItems.length,
      data: savedMenuItems,
    });
  } catch (err) {
    const errorResponse = buildMenuErrorResponse(err);
    res.status(errorResponse.statusCode).json(errorResponse.body);
  }
};

//@desc   Update a menu item for a restaurant
//@route  PUT /api/v1/restaurants/:restaurantId/menu/:menuItemId
//@access Private
exports.updateMenuItem = async (req, res, next) => {
  try {
    const restaurant = await getRestaurantOr404(req.params.restaurantId, res);

    if (!restaurant) {
      return;
    }

    if (!canManageRestaurant(restaurant, req.user)) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to update this restaurant menu",
      });
    }

    const menuItem = await MenuItem.findOne({
      _id: req.params.menuItemId,
      restaurant: req.params.restaurantId,
    });

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        error: `Menu item not found with id of ${req.params.menuItemId}`,
      });
    }

    const menuItemPayload = buildMenuItemPayload(req.body);

    const updatedMenuItem = await MenuItem.findByIdAndUpdate(
      req.params.menuItemId,
      menuItemPayload,
      {
        new: true,
        runValidators: true,
      },
    );

    res.status(200).json({
      success: true,
      message: "Menu item updated successfully",
      data: updatedMenuItem,
    });
  } catch (err) {
    const errorResponse = buildMenuErrorResponse(err);
    res.status(errorResponse.statusCode).json(errorResponse.body);
  }
};

//@desc   Delete a menu item from a restaurant
//@route  DELETE /api/v1/restaurants/:restaurantId/menu/:menuItemId
//@access Private
exports.deleteMenuItem = async (req, res, next) => {
  try {
    const restaurant = await getRestaurantOr404(req.params.restaurantId, res);

    if (!restaurant) {
      return;
    }

    if (!canManageRestaurant(restaurant, req.user)) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to update this restaurant menu",
      });
    }

    const menuItem = await MenuItem.findOne({
      _id: req.params.menuItemId,
      restaurant: req.params.restaurantId,
    });

    if (!menuItem) {
      return res.status(404).json({
        success: false,
        error: `Menu item not found with id of ${req.params.menuItemId}`,
      });
    }

    await MenuItem.deleteOne({ _id: menuItem._id });
    await Restaurant.updateOne(
      { _id: restaurant._id },
      { $pull: { menu: menuItem._id } },
    );

    res.status(200).json({
      success: true,
      message: "Menu item deleted successfully",
      data: {},
    });
  } catch (err) {
    const errorResponse = buildMenuErrorResponse(err);
    res.status(errorResponse.statusCode).json(errorResponse.body);
  }
};
