const mongoose = require("mongoose");

const ItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please add an item name"],
    trim: true,
    maxlength: [100, "Item name can not be more than 100 characters"],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [300, "Item description can not be more than 300 characters"],
  },
  price: {
    type: Number,
    min: [0, "Item price must be greater than or equal to 0"],
  },
  category: {
    type: String,
    trim: true,
    maxlength: [50, "Item category can not be more than 50 characters"],
  },
  picture: {
    type: String,
    trim: true,
  },
});

const MenuSchema = new mongoose.Schema({
  restaurant: {
    type: mongoose.Schema.ObjectId,
    ref: "Restaurant",
    required: [true, "Please add a restaurant"],
  },
  title: {
    type: String,
    required: [true, "Please add a menu title"],
    trim: true,
    maxlength: [100, "Menu title can not be more than 100 characters"],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [300, "Menu description can not be more than 300 characters"],
  },
  items: {
    type: [ItemSchema],
    default: [],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

MenuSchema.index({ restaurant: 1, title: 1 });

module.exports = mongoose.model("Menu", MenuSchema);
