const express = require('express');
const {
    getReviews,
    getReview,
    addReview,
    updateReview,
    deleteReview,
    getRestaurantRating
} = require('../controllers/reviews');

const { protect } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });


router.route('/')
  .get(getReviews)
  .post(protect, addReview);

router.get('/rating', getRestaurantRating);

router.route('/:id')
  .get(getReview)
  .put(protect, updateReview)
  .delete(protect, deleteReview);

module.exports = router;