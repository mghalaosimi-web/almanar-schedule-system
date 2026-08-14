const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'backend', '.env') });

const { defineConfig } = require("prisma/config");

module.exports = defineConfig({
  schema: "backend/prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
