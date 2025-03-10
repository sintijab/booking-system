const express = require("express");
const pkg = require("pg");
const { Pool } = pkg;
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const db = require('./db.js');

const calendarRouter = require("./routes/calendar");
const bookRouter = require("./routes/book");

dotenv.config();

const app = express();
app.use(bodyParser.json());

app.use("/calendar", calendarRouter);
app.use("/book", bookRouter);

const pool = new Pool({
  connectionString: db.connectionString,
});

app.get("/health", async (_, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({ status: "OK" });
  } catch (error) {
    console.error("Health check error:", error);
    res.status(500).json({ status: "error", error: "Database unreachable" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
module.exports = { app, pool };
