const mongoose = require('mongoose');

const RestaurantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a name'],
    unique: true,
    trim: true,
    maxlength: [50, 'Name can not be more than 50 characters']
  },
  address: {
    type: String,
    required: [true, 'Please add an address']
  },
  telephone: {
    type: String,
    required: [true, 'Please add a telephone number']
  },
  openTime: {
    type: String,
    required: [true, 'Please add an open time (e.g., 10:00)']
  },
  closeTime: {
    type: String,
    required: [true, 'Please add a close time (e.g., 22:00)']
  },
  picture: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
},{
toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Reverse populate with virtuals
RestaurantSchema.virtual('reservations', {
  ref: 'Reservation',
  localField: '_id',
  foreignField: 'restaurant',
  justOne: false
});

RestaurantSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'restaurant',
  justOne: false
});

module.exports = mongoose.model('Restaurant', RestaurantSchema);
