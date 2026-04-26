[![Review Assignment Due Date](https://classroom.github.com/assets/deadline-readme-button-22041afd0340ce965d47ae6ef1cefeee28c7c493a6346c4f15d667ab976d596c.svg)](https://classroom.github.com/a/5TpXTvuY)

# Backend Setup

Copy `config/config.env.example` to `config/config.env` before starting the server.

Required environment variables:

```env
NODE_ENV=development
PORT=5050
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
JWT_EXPIRE=30d
JWT_COOKIE_EXPIRE=30
```

The server loads this file from `./config/config.env` in `server.js`.

For production or fixed deployed frontends, add allowed frontend origins:

```env
FRONTEND_URLS=https://your-frontend.example.com,http://localhost:3000
```

In local development, private LAN frontend origins on ports `3000`, `3001`, and `3002` are allowed automatically.

For Vercel deployment, add the required environment variables in the Vercel project settings. `vercel.json` routes all requests to `server.js`.

# API Docs

After starting the backend, open Swagger UI at:

```text
http://localhost:5050/api-docs
```

The raw OpenAPI document is available at:

```text
http://localhost:5050/api-docs.json
```

# Docker Local Run

Build the backend image:

```bash
docker build -t ratatouille-be .
```

Run the backend container with the local env file:

```bash
docker run --rm -p 5050:5050 --env-file config/config.env --name ratatouille-be ratatouille-be
```

The API should then be available at `http://localhost:5050`.

## Docker Compose Local Stack

This compose file expects the frontend repo to be next to this backend repo:

```text
fe/
  se-project-be-68-2-ratatouile/
  se-project-fe-68-2-ratatouile/
```

Start MongoDB, backend, and frontend together:

```bash
docker compose up --build
```

Open the app at `http://localhost:3000`. The backend API is available at `http://localhost:5050`.

Stop the stack:

```bash
docker compose down
```

Remove the local MongoDB volume too:

```bash
docker compose down -v
```
