const mongoose = require('mongoose');

const ReservationSchema = new mongoose.Schema({
  reservationDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['waiting', 'approved', 'rejected'],
    default: 'waiting',
    required: true
  },
  reason_reject: {
    type: String,
    trim: true,
    maxlength: [300, 'Reject reason can not be more than 300 characters'],
    default: ''
  },
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  restaurant: {
    type: mongoose.Schema.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Reservation', ReservationSchema);
