const mongoose = require("mongoose");

const MenuItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please add a menu item name"],
    trim: true,
    maxlength: [100, "Menu item name can not be more than 100 characters"],
  },
  description: {
    type: String,
    trim: true,
    maxlength: [
      300,
      "Menu item description can not be more than 300 characters",
    ],
  },
  price: {
    type: Number,
    min: [0, "Menu item price must be greater than or equal to 0"],
  },
  category: {
    type: String,
    trim: true,
    maxlength: [50, "Menu item category can not be more than 50 characters"],
  },
  picture: {
    type: String,
    trim: true,
  },
});

module.exports = MenuItemSchema;
