const express = require('express');
const dotenv = require('dotenv');
const connectDB = require('./config/db'); 
const cookieParser = require('cookie-parser');


dotenv.config({ path: './config/config.env' });

connectDB();

const restaurant  = require('./routes/restaurants');
const auth = require('./routes/auth');
const reservations =require('./routes/reservations');
const reviews = require('./routes/reviews');
const cors = require('cors');

const app = express();

const defaultAllowedOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];

const allowedOrigins = [
  ...defaultAllowedOrigins,
  ...(process.env.FRONTEND_URLS || process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
];

const corsOptions = {
  origin(origin, callback) {
    // Allow non-browser clients and explicit frontend origins.
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));


app.use(express.json());
app.set('query parser','extended');

app.use(cookieParser());
app.use('/api/v1/restaurants',restaurant);
app.use('/api/v1/auth',auth);
app.use('/api/v1/reservations',reservations);
app.use('/api/v1/reviews',reviews);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(
    'Server running in',
    process.env.NODE_ENV,
    'mode on port',
    PORT
  );
});

process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);

  // Close server & exit process
  server.close(() => process.exit(1));
});
