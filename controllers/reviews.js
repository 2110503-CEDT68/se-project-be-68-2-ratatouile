const Review = require('../models/Review');
const Restaurant = require('../models/Restaurant');

// @desc     Get all reviews for a restaurant
// @route    GET /api/v1/restaurants/:restaurantId/reviews
// @access   Public
exports.getReviews = async (req, res, next) => {
    try {
        const { restaurantId } = req.params;

        // Check if restaurant exists
        const restaurant = await Restaurant.findById(restaurantId);
        if (!restaurant) {
            return res.status(404).json({
                success: false,
                message: `No restaurant with the id of ${restaurantId}`
            });
        }

        const reviews = await Review.find({ restaurant: restaurantId })
            .populate({
                path: 'user',
                select: 'name'
            }).populate({
                path: 'restaurant',
                select: 'name'
            });

        res.status(200).json({
            success: true,
            count: reviews.length,
            data: reviews
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: 'Cannot fetch reviews'
        });
    }
};

// @desc     Get a single review
// @route    GET /api/v1/reviews/:id
// @access   Public
exports.getReview = async (req, res, next) => {
    try {
        const review = await Review.findById(req.params.id)
            .populate({
                path: 'user',
                select: 'name'
            })
            .populate({
                path: 'restaurant',
                select: 'name'
            });

        if (!review) {
            return res.status(404).json({
                success: false,
                message: `No review with the id of ${req.params.id}`
            });
        }

        res.status(200).json({
            success: true,
            data: review
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: 'Cannot fetch review'
        });
    }
};

// @desc     Add review to restaurant
// @route    POST /api/v1/restaurants/:restaurantId/reviews
// @access   Private
exports.addReview = async (req, res, next) => {
    try {
        const { restaurantId } = req.params;
        const { rating, comment } = req.body;
        

        // Validation
        if (!rating || !comment) {
            return res.status(400).json({
                success: false,
                message: 'Please provide rating and comment'
            });
        }

        if (rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: 'Rating must be between 1 and 5'
            });
        }

        // Check if restaurant exists
        const restaurant = await Restaurant.findById(restaurantId);
        if (!restaurant) {
            return res.status(404).json({
                success: false,
                message: `No restaurant with the id of ${restaurantId}`
            });
        }

        // Check if user already reviewed this restaurant
        const existingReview = await Review.findOne({
            user: req.user.id,
            restaurant: restaurantId
        });

        if (existingReview) {
            return res.status(400).json({
                success: false,
                message: 'You have already reviewed this restaurant'
            });
        }

        // Create review
        const review = await Review.create({
            rating,
            comment,
            user: req.user.id,
            restaurant: restaurantId
        });

        res.status(201).json({
            success: true,
            data: review
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: 'Cannot create review'
        });
    }
};

// @desc     Update review
// @route    PUT /api/v1/reviews/:id
// @access   Private
exports.updateReview = async (req, res, next) => {
    try {
        const { rating, comment } = req.body;

        let review = await Review.findById(req.params.id);

        if (!review) {
            return res.status(404).json({
                success: false,
                message: `No review with the id of ${req.params.id}`
            });
        }

        // Ensure user is review owner
        if (review.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({
                success: false,
                message: 'Not authorized to update this review'
            });
        }

        // Validation
        if (rating && (rating < 1 || rating > 5)) {
            return res.status(400).json({
                success: false,
                message: 'Rating must be between 1 and 5'
            });
        }

        if (rating) review.rating = rating;
        if (comment) review.comment = comment;

        review = await review.save();

        res.status(200).json({
            success: true,
            data: review
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: 'Cannot update review'
        });
    }
};

// @desc     Delete review
// @route    DELETE /api/v1/reviews/:id
// @access   Private
exports.deleteReview = async (req, res, next) => {
    try {
        const review = await Review.findById(req.params.id);

        if (!review) {
            return res.status(404).json({
                success: false,
                message: `No review with the id of ${req.params.id}`
            });
        }

        // Ensure user is review owner
        if (review.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({
                success: false,
                message: 'Not authorized to delete this review'
            });
        }

        await Review.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            message: 'Review deleted'
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: 'Cannot delete review'
        });
    }
};

// @desc     Get average rating for a restaurant
// @route    GET /api/v1/restaurants/:restaurantId/rating
// @access   Public
exports.getRestaurantRating = async (req, res, next) => {
    try {
        const { restaurantId } = req.params;

        // Check if restaurant exists
        const restaurant = await Restaurant.findById(restaurantId);
        if (!restaurant) {
            return res.status(404).json({
                success: false,
                message: `No restaurant with the id of ${restaurantId}`
            });
        }

        const reviews = await Review.find({ restaurant: restaurantId });

        if (reviews.length === 0) {
            return res.status(200).json({
                success: true,
                averageRating: 0,
                totalReviews: 0
            });
        }

        const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
        const averageRating = (totalRating / reviews.length).toFixed(2);

        res.status(200).json({
            success: true,
            averageRating: parseFloat(averageRating),
            totalReviews: reviews.length
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: 'Cannot fetch restaurant rating'
        });
    }
};
