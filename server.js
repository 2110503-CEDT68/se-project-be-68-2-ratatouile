const dotenv = require('dotenv');
const connectDB = require('./config/db');
const app = require('./app');

dotenv.config({ path: './config/config.env' });

let server;

const startServer = async () => {
  await connectDB();

  const PORT = process.env.PORT || 5000;

  server = app.listen(PORT, () => {
    console.log(
      'Server running in',
      process.env.NODE_ENV,
      'mode on port',
      PORT
    );
  });

  return server;
};

if (require.main === module) {
  startServer();

  process.on('unhandledRejection', (err) => {
    console.log(`Error: ${err.message}`);

    if (!server) {
      process.exit(1);
    }

    server.close(() => process.exit(1));
  });
}

module.exports = app;
module.exports.startServer = startServer;
