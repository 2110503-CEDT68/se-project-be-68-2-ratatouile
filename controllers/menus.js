const Restaurant = require("../models/Restaurant");
const Menu = require("../models/Menu");

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
      error: err.message || "Unable to process menu request",
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

const getMenuOr404 = async (restaurantId, menuId, res) => {
  const menu = await Menu.findOne({
    _id: menuId,
    restaurant: restaurantId,
  });

  if (!menu) {
    res.status(404).json({
      success: false,
      error: `Menu not found with id of ${menuId}`,
    });
    return null;
  }

  return menu;
};

const buildMenuPayload = (payload) => {
  const { _id, id, restaurant, ...menuPayload } = payload;

  return menuPayload;
};

const getMenuId = (payload) => payload._id || payload.id;

//@desc   Get all menus for a restaurant
//@route  GET /api/v1/restaurants/:restaurantId/menus
//@access Public
exports.getMenus = async (req, res, next) => {
  try {
    const restaurant = await getRestaurantOr404(req.params.restaurantId, res);

    if (!restaurant) {
      return;
    }

    const menus = await Menu.find({
      restaurant: req.params.restaurantId,
    }).sort("createdAt title");

    res.status(200).json({
      success: true,
      count: menus.length,
      data: menus,
    });
  } catch (err) {
    const errorResponse = buildMenuErrorResponse(err);
    res.status(errorResponse.statusCode).json(errorResponse.body);
  }
};

//@desc   Get a single menu for a restaurant
//@route  GET /api/v1/restaurants/:restaurantId/menus/:menuId
//@access Public
exports.getMenu = async (req, res, next) => {
  try {
    const restaurant = await getRestaurantOr404(req.params.restaurantId, res);

    if (!restaurant) {
      return;
    }

    const menu = await getMenuOr404(
      req.params.restaurantId,
      req.params.menuId,
      res,
    );

    if (!menu) {
      return;
    }

    res.status(200).json({
      success: true,
      data: menu,
    });
  } catch (err) {
    const errorResponse = buildMenuErrorResponse(err);
    res.status(errorResponse.statusCode).json(errorResponse.body);
  }
};

//@desc   Add a menu to a restaurant
//@route  POST /api/v1/restaurants/:restaurantId/menus
//@access Private
exports.addMenu = async (req, res, next) => {
  try {
    const restaurant = await getRestaurantOr404(req.params.restaurantId, res);

    if (!restaurant) {
      return;
    }

    if (!canManageRestaurant(restaurant, req.user)) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to update this restaurant menus",
      });
    }

    const menu = await Menu.create({
      ...buildMenuPayload(req.body),
      restaurant: restaurant._id,
    });

    await Restaurant.updateOne(
      { _id: restaurant._id },
      { $addToSet: { menus: menu._id } },
    );

    res.status(201).json({
      success: true,
      message: "Menu created successfully",
      data: menu,
    });
  } catch (err) {
    const errorResponse = buildMenuErrorResponse(err);
    res.status(errorResponse.statusCode).json(errorResponse.body);
  }
};

//@desc   Add multiple menus to a restaurant
//@route  POST /api/v1/restaurants/:restaurantId/menus/bulk
//@access Private
exports.addMenus = async (req, res, next) => {
  try {
    const restaurant = await getRestaurantOr404(req.params.restaurantId, res);

    if (!restaurant) {
      return;
    }

    if (!canManageRestaurant(restaurant, req.user)) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to update this restaurant menus",
      });
    }

    const menus = req.body.menus;

    if (!Array.isArray(menus) || menus.length === 0) {
      return res.status(422).json({
        success: false,
        error: ["Please add at least one menu"],
      });
    }

    const createdMenus = await Menu.insertMany(
      menus.map((menu) => ({
        ...buildMenuPayload(menu),
        restaurant: restaurant._id,
      })),
      { ordered: true },
    );

    await Restaurant.updateOne(
      { _id: restaurant._id },
      {
        $addToSet: {
          menus: { $each: createdMenus.map((menu) => menu._id) },
        },
      },
    );

    res.status(201).json({
      success: true,
      message: "Menus created successfully",
      count: createdMenus.length,
      data: createdMenus,
    });
  } catch (err) {
    const errorResponse = buildMenuErrorResponse(err);
    res.status(errorResponse.statusCode).json(errorResponse.body);
  }
};

//@desc   Save multiple menus by creating new menus and updating existing menus
//@route  PUT /api/v1/restaurants/:restaurantId/menus/bulk
//@access Private
exports.saveMenus = async (req, res, next) => {
  try {
    const restaurant = await getRestaurantOr404(req.params.restaurantId, res);

    if (!restaurant) {
      return;
    }

    if (!canManageRestaurant(restaurant, req.user)) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to update this restaurant menus",
      });
    }

    const menus = req.body.menus;

    if (!Array.isArray(menus) || menus.length === 0) {
      return res.status(422).json({
        success: false,
        error: ["Please add at least one menu"],
      });
    }

    const menusToCreate = menus.filter((menu) => !getMenuId(menu));
    const menusToUpdate = menus.filter((menu) => getMenuId(menu));
    const updatedMenus = [];

    for (const menu of menusToUpdate) {
      const menuId = getMenuId(menu);
      const updatedMenu = await Menu.findOneAndUpdate(
        {
          _id: menuId,
          restaurant: restaurant._id,
        },
        buildMenuPayload(menu),
        {
          new: true,
          runValidators: true,
        },
      );

      if (!updatedMenu) {
        return res.status(404).json({
          success: false,
          error: `Menu not found with id of ${menuId}`,
        });
      }

      updatedMenus.push(updatedMenu);
    }

    const createdMenus =
      menusToCreate.length > 0
        ? await Menu.insertMany(
            menusToCreate.map((menu) => ({
              ...buildMenuPayload(menu),
              restaurant: restaurant._id,
            })),
            { ordered: true },
          )
        : [];
    const savedMenus = [...updatedMenus, ...createdMenus];

    await Restaurant.updateOne(
      { _id: restaurant._id },
      {
        $addToSet: {
          menus: { $each: savedMenus.map((menu) => menu._id) },
        },
      },
    );

    res.status(200).json({
      success: true,
      message: "Menus saved successfully",
      createdCount: createdMenus.length,
      updatedCount: updatedMenus.length,
      count: savedMenus.length,
      data: savedMenus,
    });
  } catch (err) {
    const errorResponse = buildMenuErrorResponse(err);
    res.status(errorResponse.statusCode).json(errorResponse.body);
  }
};

//@desc   Update a menu for a restaurant
//@route  PUT /api/v1/restaurants/:restaurantId/menus/:menuId
//@access Private
exports.updateMenu = async (req, res, next) => {
  try {
    const restaurant = await getRestaurantOr404(req.params.restaurantId, res);

    if (!restaurant) {
      return;
    }

    if (!canManageRestaurant(restaurant, req.user)) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to update this restaurant menus",
      });
    }

    const menu = await Menu.findOneAndUpdate(
      {
        _id: req.params.menuId,
        restaurant: req.params.restaurantId,
      },
      buildMenuPayload(req.body),
      {
        new: true,
        runValidators: true,
      },
    );

    if (!menu) {
      return res.status(404).json({
        success: false,
        error: `Menu not found with id of ${req.params.menuId}`,
      });
    }

    res.status(200).json({
      success: true,
      message: "Menu updated successfully",
      data: menu,
    });
  } catch (err) {
    const errorResponse = buildMenuErrorResponse(err);
    res.status(errorResponse.statusCode).json(errorResponse.body);
  }
};

//@desc   Delete a menu from a restaurant
//@route  DELETE /api/v1/restaurants/:restaurantId/menus/:menuId
//@access Private
exports.deleteMenu = async (req, res, next) => {
  try {
    const restaurant = await getRestaurantOr404(req.params.restaurantId, res);

    if (!restaurant) {
      return;
    }

    if (!canManageRestaurant(restaurant, req.user)) {
      return res.status(403).json({
        success: false,
        error: "Not authorized to update this restaurant menus",
      });
    }

    const menu = await getMenuOr404(
      req.params.restaurantId,
      req.params.menuId,
      res,
    );

    if (!menu) {
      return;
    }

    await Menu.deleteOne({ _id: menu._id });
    await Restaurant.updateOne(
      { _id: restaurant._id },
      { $pull: { menus: menu._id } },
    );

    res.status(200).json({
      success: true,
      message: "Menu deleted successfully",
      data: {},
    });
  } catch (err) {
    const errorResponse = buildMenuErrorResponse(err);
    res.status(errorResponse.statusCode).json(errorResponse.body);
  }
};
