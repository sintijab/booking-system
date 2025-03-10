const express = require("express");
const router = express.Router();
const { assignBooking } = require("../utils");

router.post("/", async (req, res) => {
  try {
    const bookingDetails = req.body;
    // bookingDetails = { date, products, language, rating, desired_start_date, customer_id }
    const bookingId = await assignBooking(bookingDetails);
    res.json({ bookingId });
  } catch (error) {
    console.error("Error in /book:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;