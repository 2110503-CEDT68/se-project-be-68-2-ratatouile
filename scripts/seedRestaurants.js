const dotenv = require('dotenv');
const mongoose = require('mongoose');
const Restaurant = require('../models/Restaurant');
const Menu = require('../models/Menu');

dotenv.config({ path: './config/config.env' });

const restaurants = [
  {
    name: 'Saffron Table',
    address: '12 Sukhumvit 24, Khlong Tan, Bangkok 10110',
    telephone: '0812345678',
    openTime: '11:00',
    closeTime: '22:00',
    picture: '/img/1.png',
    menus: [
      {
        title: 'Main Menu',
        items: [
          {
            name: 'Tom Yum River Prawn Pasta',
            description: 'Creamy spicy pasta with grilled river prawn.',
            price: 320,
            category: 'Main Course'
          },
          {
            name: 'Thai Milk Tea Tiramisu',
            description: 'Soft layered tiramisu infused with Thai tea.',
            price: 165,
            category: 'Dessert'
          }
        ]
      }
    ]
  },
  {
    name: 'Amber Grill House',
    address: '88 Rama IX Road, Huai Khwang, Bangkok 10310',
    telephone: '0823456789',
    openTime: '10:30',
    closeTime: '21:30',
    picture: '/img/2.png',
    menus: [
      {
        title: 'Signature Menu',
        items: [
          {
            name: 'Charcoal Ribeye',
            description: 'Australian ribeye with roasted garlic butter.',
            price: 890,
            category: 'Steak'
          },
          {
            name: 'Truffle Fries',
            description: 'Crispy fries with truffle oil and parmesan.',
            price: 190,
            category: 'Side'
          }
        ]
      }
    ]
  },
  {
    name: 'Lemon Basil Kitchen',
    address: '45 Nimmanhemin Soi 7, Chiang Mai 50200',
    telephone: '0834567890',
    openTime: '09:00',
    closeTime: '20:30',
    picture: '/img/3.png',
    menus: [
      {
        title: 'All Day Menu',
        items: [
          {
            name: 'Grilled Salmon Rice Bowl',
            description: 'Salmon, jasmine rice, herbs, and citrus dressing.',
            price: 295,
            category: 'Bowl'
          },
          {
            name: 'Yuzu Sparkling Soda',
            description: 'Refreshing sparkling soda with yuzu and mint.',
            price: 120,
            category: 'Drink'
          }
        ]
      }
    ]
  },
  {
    name: 'Harbor Oven',
    address: '7 Beach Road, Pattaya City, Chonburi 20150',
    telephone: '0845678901',
    openTime: '08:00',
    closeTime: '21:00',
    picture: '/img/4.png',
    menus: [
      {
        title: 'Oven Specials',
        items: [
          {
            name: 'Woodfired Burrata Pizza',
            description: 'Neapolitan-style pizza with burrata and basil.',
            price: 420,
            category: 'Pizza'
          },
          {
            name: 'Roasted Tomato Soup',
            description: 'Smooth roasted tomato soup with garlic toast.',
            price: 180,
            category: 'Soup'
          }
        ]
      }
    ]
  },
  {
    name: 'Moonrice Eatery',
    address: '101 Mittraphap Road, Nai Mueang, Khon Kaen 40000',
    telephone: '0856789012',
    openTime: '11:30',
    closeTime: '23:00',
    picture: '/img/5.png',
    menus: [
      {
        title: 'Chef Picks',
        items: [
          {
            name: 'Beef Massaman Rice Set',
            description: 'Slow-cooked beef curry with fragrant rice.',
            price: 260,
            category: 'Rice Set'
          },
          {
            name: 'Coconut Ice Cream Toast',
            description: 'Butter toast with coconut ice cream and peanuts.',
            price: 155,
            category: 'Dessert'
          }
        ]
      }
    ]
  }
];

async function seedRestaurants() {
  try {
    const mongoUri = process.env.MONGO_URI;

    if (!mongoUri) {
      throw new Error('MONGO_URI is missing from config/config.env');
    }

    await mongoose.connect(mongoUri);

    for (const restaurant of restaurants) {
      const { menus = [], ...restaurantPayload } = restaurant;
      const savedRestaurant = await Restaurant.findOneAndUpdate(
        { name: restaurant.name },
        restaurantPayload,
        {
          upsert: true,
          new: true,
          runValidators: true,
          setDefaultsOnInsert: true
        }
      );

      await Menu.deleteMany({ restaurant: savedRestaurant._id });

      let menuIds = [];

      if (menus.length > 0) {
        const createdMenus = await Menu.insertMany(
          menus.map((menu) => ({
            ...menu,
            restaurant: savedRestaurant._id
          }))
        );

        menuIds = createdMenus.map((menu) => menu._id);
      }

      await Restaurant.updateOne(
        { _id: savedRestaurant._id },
        { $set: { menus: menuIds } }
      );
    }

    const totalRestaurants = await Restaurant.countDocuments();
    console.log(`Seeded restaurants successfully. Total restaurants: ${totalRestaurants}`);
  } catch (error) {
    console.error('Failed to seed restaurants:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

seedRestaurants();
