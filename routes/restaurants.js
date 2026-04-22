const express = require('express');
const {
  getRestaurants,
  getRestaurant,
  createRestaurant,
  updateRestaurant,
  deleteRestaurant,
} = require('../controllers/restaurants');

// Include other resource routers
const reservationRouter = require('./reservations');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const reviewRouter = require('./reviews');
const {
  getMenus,
  getMenu,
  addMenu,
  addMenus,
  saveMenus,
  updateMenu,
  deleteMenu,
} = require('../controllers/menus');

// Re-route into other resource routers
router.use('/:restaurantId/reservations', reservationRouter);
router
  .route('/')
  .get(getRestaurants)
  .post(protect, authorize('admin', 'restaurantOwner'), createRestaurant);
router
  .route('/:restaurantId/menu')
  .get(getMenus)
  .post(protect, authorize('admin', 'restaurantOwner'), addMenu);
router
  .route('/:restaurantId/menu/bulk')
  .post(protect, authorize('admin', 'restaurantOwner'), addMenus)
  .put(protect, authorize('admin', 'restaurantOwner'), saveMenus);
router
  .route('/:restaurantId/menu/:menuId')
  .get(getMenu)
  .put(protect, authorize('admin', 'restaurantOwner'), updateMenu)
  .delete(protect, authorize('admin', 'restaurantOwner'), deleteMenu);
router
  .route('/:restaurantId/menus')
  .get(getMenus)
  .post(protect, authorize('admin', 'restaurantOwner'), addMenu);
router
  .route('/:restaurantId/menus/bulk')
  .post(protect, authorize('admin', 'restaurantOwner'), addMenus)
  .put(protect, authorize('admin', 'restaurantOwner'), saveMenus);
router
  .route('/:restaurantId/menus/:menuId')
  .get(getMenu)
  .put(protect, authorize('admin', 'restaurantOwner'), updateMenu)
  .delete(protect, authorize('admin', 'restaurantOwner'), deleteMenu);
router
  .route('/:id')
  .get(getRestaurant)
  .put(protect, authorize('admin', 'restaurantOwner'), updateRestaurant)
  .delete(protect, authorize('admin', 'restaurantOwner'), deleteRestaurant);
router.use('/:restaurantId/reviews', reviewRouter);

module.exports = router;
