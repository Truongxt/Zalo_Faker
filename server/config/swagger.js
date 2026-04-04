const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "My API",
      version: "1.0.0",
      description: "Demo Swagger",
    },
    servers: [
      {
        url: "http://localhost:3000/api",
      },
    ],

    // 🔥 THÊM ĐOẠN NÀY
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },

    security: [
      {
        bearerAuth: [],
      },
    ],
  },

  apis: ["./routes/*.js"], // quét comment swagger
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;