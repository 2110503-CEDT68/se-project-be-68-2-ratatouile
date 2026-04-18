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
app.use(cors());


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
