const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');

const restaurants = require('./routes/restaurants');
const auth = require('./routes/auth');
const reservations = require('./routes/reservations');
const reviews = require('./routes/reviews');
const openApiSpec = require('./docs/openapi');

const app = express();

const defaultAllowedOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'http://localhost:3002'];
const devFrontendPorts = new Set(['3000', '3001', '3002']);

const allowedOrigins = [
  ...defaultAllowedOrigins,
  ...(process.env.FRONTEND_URLS || process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
];

const isPrivateIp = (hostname) => {
  const parts = hostname.split('.').map(Number);

  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }

  const [first, second] = parts;
  return (
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
};

const isAllowedDevLanOrigin = (origin) => {
  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  try {
    const url = new URL(origin);
    return url.protocol === 'http:' && devFrontendPorts.has(url.port) && isPrivateIp(url.hostname);
  } catch (_err) {
    return false;
  }
};

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || isAllowedDevLanOrigin(origin)) {
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
app.set('query parser', 'extended');
app.use(cookieParser());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/api-docs.json', (_req, res) => {
  res.status(200).json(openApiSpec);
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

app.use('/api/v1/restaurants', restaurants);
app.use('/api/v1/auth', auth);
app.use('/api/v1/reservations', reservations);
app.use('/api/v1/reviews', reviews);

module.exports = app;
