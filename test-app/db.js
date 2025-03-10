const { Pool } = require("pg");
const dotenv = require("dotenv");
dotenv.config();

const connectionString = `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST || "localhost"}:${process.env.POSTGRES_PORT || "5433"}/${process.env.POSTGRES_DB}`;

const pool = new Pool({
  connectionString
});

module.exports = { pool, connectionString };
