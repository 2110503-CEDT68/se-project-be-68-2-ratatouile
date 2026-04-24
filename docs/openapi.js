const restaurantExample = {
  _id: '69e3664731babf4f917295cc',
  owner: '69e4ff066020783716b9e89e',
  name: 'Saffron Table',
  address: '12 Sukhumvit 24, Khlong Tan, Bangkok 10110',
  telephone: '0812345678',
  openTime: '11:00',
  closeTime: '22:00',
  picture: '/img/1.png',
  menus: ['69e715e66c6a3049b33895d5'],
  createdAt: '2026-04-18T11:08:55.472Z',
};

const menuExample = {
  _id: '69e715e66c6a3049b33895d5',
  restaurant: '69e3664731babf4f917295cc',
  title: 'Lunch Menu',
  description: 'Popular lunch dishes',
  items: [
    {
      _id: '69e721e2fc21f872d166bc56',
      name: 'Pad Thai',
      description: 'Stir-fried rice noodles',
      price: 89,
      category: 'Noodle',
      picture: '/img/pad-thai.png',
    },
  ],
  createdAt: '2026-04-18T11:08:55.472Z',
};

const reservationExample = {
  _id: '69e900000000000000000001',
  reservationDate: '2026-04-24T12:30:00.000Z',
  status: 'waiting',
  reason_reject: '',
  user: '69e4ff066020783716b9e89e',
  restaurant: '69e3664731babf4f917295cc',
  createdAt: '2026-04-18T11:08:55.472Z',
};

const okResponse = (schemaRef, many = false) => ({
  description: 'Successful response',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          count: many ? { type: 'integer', example: 1 } : undefined,
          data: many
            ? { type: 'array', items: { $ref: schemaRef } }
            : { $ref: schemaRef },
        },
      },
    },
  },
});

const errorResponses = {
  400: { $ref: '#/components/responses/BadRequest' },
  401: { $ref: '#/components/responses/Unauthorized' },
  403: { $ref: '#/components/responses/Forbidden' },
  404: { $ref: '#/components/responses/NotFound' },
};

module.exports = {
  openapi: '3.0.3',
  info: {
    title: 'Ratatouille Backend API',
    version: '1.0.0',
    description: 'API documentation for authentication, restaurants, menus, reservations, and reviews.',
  },
  servers: [
    {
      url: 'http://localhost:5050',
      description: 'Local backend',
    },
    {
      url: 'https://ratata-bay.vercel.app',
      description: 'Deployed backend',
    },
  ],
  tags: [
    { name: 'Health' },
    { name: 'Auth' },
    { name: 'Restaurants' },
    { name: 'Menus' },
    { name: 'Reservations' },
    { name: 'Reviews' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Check server health',
        responses: {
          200: {
            description: 'Server is running',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/v1/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RegisterInput' },
            },
          },
        },
        responses: {
          200: okResponse('#/components/schemas/AuthToken'),
          400: errorResponses[400],
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Log in and receive a JWT',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/LoginInput' },
            },
          },
        },
        responses: {
          200: okResponse('#/components/schemas/AuthToken'),
          401: errorResponses[401],
        },
      },
    },
    '/api/v1/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get current user',
        security: [{ bearerAuth: [] }],
        responses: {
          200: okResponse('#/components/schemas/User'),
          401: errorResponses[401],
        },
      },
    },
    '/api/v1/auth/logout': {
      get: {
        tags: ['Auth'],
        summary: 'Log out current user',
        security: [{ bearerAuth: [] }],
        responses: {
          200: okResponse('#/components/schemas/MessageResponse'),
          401: errorResponses[401],
        },
      },
    },
    '/api/v1/restaurants': {
      get: {
        tags: ['Restaurants'],
        summary: 'Get all restaurants',
        responses: {
          200: okResponse('#/components/schemas/Restaurant', true),
        },
      },
      post: {
        tags: ['Restaurants'],
        summary: 'Create a restaurant',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RestaurantInput' },
            },
          },
        },
        responses: {
          201: okResponse('#/components/schemas/Restaurant'),
          ...errorResponses,
        },
      },
    },
    '/api/v1/restaurants/{restaurantId}': {
      parameters: [{ $ref: '#/components/parameters/RestaurantId' }],
      get: {
        tags: ['Restaurants'],
        summary: 'Get one restaurant',
        responses: {
          200: okResponse('#/components/schemas/Restaurant'),
          404: errorResponses[404],
        },
      },
      put: {
        tags: ['Restaurants'],
        summary: 'Update a restaurant',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RestaurantInput' },
            },
          },
        },
        responses: {
          200: okResponse('#/components/schemas/Restaurant'),
          ...errorResponses,
        },
      },
      delete: {
        tags: ['Restaurants'],
        summary: 'Delete a restaurant',
        security: [{ bearerAuth: [] }],
        responses: {
          200: okResponse('#/components/schemas/MessageResponse'),
          ...errorResponses,
        },
      },
    },
    '/api/v1/restaurants/{restaurantId}/menus': {
      parameters: [{ $ref: '#/components/parameters/RestaurantId' }],
      get: {
        tags: ['Menus'],
        summary: 'Get all menus for a restaurant',
        responses: {
          200: okResponse('#/components/schemas/Menu', true),
          404: errorResponses[404],
        },
      },
      post: {
        tags: ['Menus'],
        summary: 'Add one menu to a restaurant',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/MenuInput' },
            },
          },
        },
        responses: {
          201: okResponse('#/components/schemas/Menu'),
          ...errorResponses,
        },
      },
    },
    '/api/v1/restaurants/{restaurantId}/menus/bulk': {
      parameters: [{ $ref: '#/components/parameters/RestaurantId' }],
      post: {
        tags: ['Menus'],
        summary: 'Add many menus to a restaurant',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/MenuBulkInput' },
            },
          },
        },
        responses: {
          201: okResponse('#/components/schemas/Menu', true),
          ...errorResponses,
        },
      },
      put: {
        tags: ['Menus'],
        summary: 'Replace restaurant menus with the provided menu list',
        description: 'Updates existing menus when _id is present, creates new menus without _id, and removes omitted menus for the restaurant.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/MenuBulkInput' },
            },
          },
        },
        responses: {
          200: okResponse('#/components/schemas/Menu', true),
          ...errorResponses,
        },
      },
    },
    '/api/v1/restaurants/{restaurantId}/menus/{menuId}': {
      parameters: [
        { $ref: '#/components/parameters/RestaurantId' },
        { $ref: '#/components/parameters/MenuId' },
      ],
      get: {
        tags: ['Menus'],
        summary: 'Get one menu',
        responses: {
          200: okResponse('#/components/schemas/Menu'),
          404: errorResponses[404],
        },
      },
      put: {
        tags: ['Menus'],
        summary: 'Update one menu and its items',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/MenuInput' },
            },
          },
        },
        responses: {
          200: okResponse('#/components/schemas/Menu'),
          ...errorResponses,
        },
      },
      delete: {
        tags: ['Menus'],
        summary: 'Delete one menu',
        security: [{ bearerAuth: [] }],
        responses: {
          200: okResponse('#/components/schemas/MessageResponse'),
          ...errorResponses,
        },
      },
    },
    '/api/v1/reservations': {
      get: {
        tags: ['Reservations'],
        summary: 'Get reservations for current user or owner',
        security: [{ bearerAuth: [] }],
        responses: {
          200: okResponse('#/components/schemas/Reservation', true),
          401: errorResponses[401],
        },
      },
      post: {
        tags: ['Reservations'],
        summary: 'Create a reservation',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ReservationInput' },
            },
          },
        },
        responses: {
          201: okResponse('#/components/schemas/Reservation'),
          ...errorResponses,
        },
      },
    },
    '/api/v1/restaurants/{restaurantId}/reservations': {
      parameters: [{ $ref: '#/components/parameters/RestaurantId' }],
      get: {
        tags: ['Reservations'],
        summary: 'Get reservations for a restaurant',
        security: [{ bearerAuth: [] }],
        responses: {
          200: okResponse('#/components/schemas/Reservation', true),
          ...errorResponses,
        },
      },
      post: {
        tags: ['Reservations'],
        summary: 'Create a reservation for a restaurant',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ReservationInput' },
            },
          },
        },
        responses: {
          201: okResponse('#/components/schemas/Reservation'),
          ...errorResponses,
        },
      },
    },
    '/api/v1/reservations/{reservationId}': {
      parameters: [{ $ref: '#/components/parameters/ReservationId' }],
      get: {
        tags: ['Reservations'],
        summary: 'Get one reservation',
        security: [{ bearerAuth: [] }],
        responses: {
          200: okResponse('#/components/schemas/Reservation'),
          ...errorResponses,
        },
      },
      put: {
        tags: ['Reservations'],
        summary: 'Update reservation status',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ReservationUpdateInput' },
            },
          },
        },
        responses: {
          200: okResponse('#/components/schemas/Reservation'),
          ...errorResponses,
        },
      },
      delete: {
        tags: ['Reservations'],
        summary: 'Delete a reservation',
        security: [{ bearerAuth: [] }],
        responses: {
          200: okResponse('#/components/schemas/MessageResponse'),
          ...errorResponses,
        },
      },
    },
    '/api/v1/restaurants/{restaurantId}/reviews': {
      parameters: [{ $ref: '#/components/parameters/RestaurantId' }],
      get: {
        tags: ['Reviews'],
        summary: 'Get reviews for a restaurant',
        responses: {
          200: okResponse('#/components/schemas/Review', true),
        },
      },
      post: {
        tags: ['Reviews'],
        summary: 'Add a review for a restaurant',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ReviewInput' },
            },
          },
        },
        responses: {
          201: okResponse('#/components/schemas/Review'),
          ...errorResponses,
        },
      },
    },
    '/api/v1/restaurants/{restaurantId}/reviews/rating': {
      parameters: [{ $ref: '#/components/parameters/RestaurantId' }],
      get: {
        tags: ['Reviews'],
        summary: 'Get average restaurant rating',
        responses: {
          200: okResponse('#/components/schemas/RatingResponse'),
          404: errorResponses[404],
        },
      },
    },
    '/api/v1/restaurants/{restaurantId}/reviews/{reviewId}': {
      parameters: [
        { $ref: '#/components/parameters/RestaurantId' },
        { $ref: '#/components/parameters/ReviewId' },
      ],
      get: {
        tags: ['Reviews'],
        summary: 'Get one review',
        responses: {
          200: okResponse('#/components/schemas/Review'),
          404: errorResponses[404],
        },
      },
      put: {
        tags: ['Reviews'],
        summary: 'Update a review',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ReviewInput' },
            },
          },
        },
        responses: {
          200: okResponse('#/components/schemas/Review'),
          ...errorResponses,
        },
      },
      delete: {
        tags: ['Reviews'],
        summary: 'Delete a review',
        security: [{ bearerAuth: [] }],
        responses: {
          200: okResponse('#/components/schemas/MessageResponse'),
          ...errorResponses,
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    parameters: {
      RestaurantId: {
        name: 'restaurantId',
        in: 'path',
        required: true,
        schema: { type: 'string' },
      },
      MenuId: {
        name: 'menuId',
        in: 'path',
        required: true,
        schema: { type: 'string' },
      },
      ReservationId: {
        name: 'reservationId',
        in: 'path',
        required: true,
        schema: { type: 'string' },
      },
      ReviewId: {
        name: 'reviewId',
        in: 'path',
        required: true,
        schema: { type: 'string' },
      },
    },
    responses: {
      BadRequest: {
        description: 'Invalid request',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
      Unauthorized: {
        description: 'Missing or invalid token',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
      Forbidden: {
        description: 'User role is not allowed',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
    },
    schemas: {
      AuthToken: {
        type: 'object',
        properties: {
          token: { type: 'string', example: 'jwt.token.value' },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Not authorize to access this route' },
        },
      },
      MessageResponse: {
        type: 'object',
        properties: {
          message: { type: 'string', example: 'Success' },
        },
      },
      RegisterInput: {
        type: 'object',
        required: ['name', 'email', 'telephone', 'password'],
        properties: {
          name: { type: 'string', example: 'Admin' },
          email: { type: 'string', format: 'email', example: 'admin@example.com' },
          telephone: { type: 'string', example: '0812345678' },
          role: { type: 'string', enum: ['user', 'admin', 'restaurantOwner'], example: 'restaurantOwner' },
          password: { type: 'string', example: '123456' },
        },
      },
      LoginInput: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', example: 'admin@example.com' },
          password: { type: 'string', example: '123456' },
        },
      },
      User: {
        type: 'object',
        properties: {
          _id: { type: 'string' },
          name: { type: 'string' },
          email: { type: 'string' },
          telephone: { type: 'string' },
          role: { type: 'string', enum: ['user', 'admin', 'restaurantOwner'] },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      RestaurantInput: {
        type: 'object',
        required: ['name', 'address', 'telephone', 'openTime', 'closeTime'],
        properties: {
          name: { type: 'string', example: restaurantExample.name },
          address: { type: 'string', example: restaurantExample.address },
          telephone: { type: 'string', example: restaurantExample.telephone },
          openTime: { type: 'string', example: restaurantExample.openTime },
          closeTime: { type: 'string', example: restaurantExample.closeTime },
          picture: { type: 'string', example: restaurantExample.picture },
        },
      },
      Restaurant: {
        allOf: [
          { $ref: '#/components/schemas/RestaurantInput' },
          {
            type: 'object',
            properties: {
              _id: { type: 'string', example: restaurantExample._id },
              owner: { type: 'string', example: restaurantExample.owner },
              menus: {
                type: 'array',
                items: { type: 'string' },
                example: restaurantExample.menus,
              },
              createdAt: { type: 'string', format: 'date-time', example: restaurantExample.createdAt },
            },
          },
        ],
      },
      ItemInput: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', example: menuExample.items[0].name },
          description: { type: 'string', example: menuExample.items[0].description },
          price: { type: 'number', example: menuExample.items[0].price },
          category: { type: 'string', example: menuExample.items[0].category },
          picture: { type: 'string', example: menuExample.items[0].picture },
        },
      },
      MenuInput: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string', example: menuExample.title },
          description: { type: 'string', example: menuExample.description },
          items: {
            type: 'array',
            items: { $ref: '#/components/schemas/ItemInput' },
          },
        },
      },
      MenuBulkInput: {
        type: 'object',
        required: ['menus'],
        properties: {
          menus: {
            type: 'array',
            items: {
              allOf: [
                { $ref: '#/components/schemas/MenuInput' },
                {
                  type: 'object',
                  properties: {
                    _id: {
                      type: 'string',
                      description: 'Include _id to update an existing menu; omit it to create a new menu.',
                      example: menuExample._id,
                    },
                  },
                },
              ],
            },
          },
        },
      },
      Menu: {
        allOf: [
          { $ref: '#/components/schemas/MenuInput' },
          {
            type: 'object',
            properties: {
              _id: { type: 'string', example: menuExample._id },
              restaurant: { type: 'string', example: menuExample.restaurant },
              items: {
                type: 'array',
                items: {
                  allOf: [
                    { $ref: '#/components/schemas/ItemInput' },
                    {
                      type: 'object',
                      properties: {
                        _id: { type: 'string', example: menuExample.items[0]._id },
                      },
                    },
                  ],
                },
              },
              createdAt: { type: 'string', format: 'date-time', example: menuExample.createdAt },
            },
          },
        ],
      },
      ReservationInput: {
        type: 'object',
        required: ['reservationDate', 'restaurant'],
        properties: {
          reservationDate: { type: 'string', format: 'date-time', example: reservationExample.reservationDate },
          restaurant: { type: 'string', example: reservationExample.restaurant },
        },
      },
      ReservationUpdateInput: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['waiting', 'approved', 'rejected'], example: 'approved' },
          reason_reject: { type: 'string', example: 'Fully booked' },
        },
      },
      Reservation: {
        allOf: [
          { $ref: '#/components/schemas/ReservationInput' },
          {
            type: 'object',
            properties: {
              _id: { type: 'string', example: reservationExample._id },
              status: { type: 'string', enum: ['waiting', 'approved', 'rejected'], example: reservationExample.status },
              reason_reject: { type: 'string', example: reservationExample.reason_reject },
              user: { type: 'string', example: reservationExample.user },
              createdAt: { type: 'string', format: 'date-time', example: reservationExample.createdAt },
            },
          },
        ],
      },
      ReviewInput: {
        type: 'object',
        required: ['rating', 'comment'],
        properties: {
          rating: { type: 'number', minimum: 1, maximum: 5, example: 5 },
          comment: { type: 'string', example: 'Great food and service.' },
        },
      },
      Review: {
        allOf: [
          { $ref: '#/components/schemas/ReviewInput' },
          {
            type: 'object',
            properties: {
              _id: { type: 'string', example: '69e900000000000000000002' },
              user: { type: 'string', example: reservationExample.user },
              restaurant: { type: 'string', example: reservationExample.restaurant },
              createdAt: { type: 'string', format: 'date-time', example: reservationExample.createdAt },
            },
          },
        ],
      },
      RatingResponse: {
        type: 'object',
        properties: {
          averageRating: { type: 'number', example: 4.5 },
          reviewCount: { type: 'integer', example: 8 },
        },
      },
    },
  },
};
