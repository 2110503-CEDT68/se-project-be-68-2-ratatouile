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
  getMenuItems,
  addMenuItem,
  addMenuItems,
  updateMenuItem,
  deleteMenuItem,
} = require('../controllers/menuItems');

// Re-route into other resource routers
router.use('/:restaurantId/reservations', reservationRouter);
router
  .route('/')
  .get(getRestaurants)
  .post(protect, authorize('admin', 'restaurantOwner'), createRestaurant);
router
  .route('/:restaurantId/menu')
  .get(getMenuItems)
  .post(protect, authorize('admin', 'restaurantOwner'), addMenuItem);
router
  .route('/:restaurantId/menu/bulk')
  .post(protect, authorize('admin', 'restaurantOwner'), addMenuItems);
router
  .route('/:restaurantId/menu/:menuItemId')
  .put(protect, authorize('admin', 'restaurantOwner'), updateMenuItem)
  .delete(protect, authorize('admin', 'restaurantOwner'), deleteMenuItem);
router
  .route('/:id')
  .get(getRestaurant)
  .put(protect, authorize('admin', 'restaurantOwner'), updateRestaurant)
  .delete(protect, authorize('admin', 'restaurantOwner'), deleteRestaurant);
router.use('/:restaurantId/reviews', reviewRouter);

module.exports = router;
