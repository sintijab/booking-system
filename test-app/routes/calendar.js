const express = require("express");
const router = express.Router();
const db = require('../db.js');
const { pgArray, isSlotValid } = require("../utils");

router.post("/query", async (req, res) => {
  try {
    const { date, products, language, rating } = req.body;
    if (!date || !products || !language || !rating) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const queryText = `
      SELECT id, start_date, end_date, booked, sales_manager_id
      FROM availability_view
      WHERE start_date::date = $1
        AND $2 = ANY(languages)
        AND $3 = ANY(customer_ratings)
        AND products @> $4::varchar[]
      ORDER BY sales_manager_id, start_date;
    `;
    const values = [date, language, rating, pgArray(products)];
    const { rows } = await db.pool.query(queryText, values);
    if (rows.length === 0) return res.json([]);

    // group slots by sales_manager
    const slotsByManager = {};
    rows.forEach(slot => {
      if (!slotsByManager[slot.sales_manager_id]) {
        slotsByManager[slot.sales_manager_id] = [];
      }
      slotsByManager[slot.sales_manager_id].push(slot);
    });

    // for each manager separate available and booked slots and filter available slots that conflict.
    const validManagerSlots = {}; // key id manager id and value array of valid available slots.
    for (const manager in slotsByManager) {
      const managerSlots = slotsByManager[manager];
      const available = managerSlots.filter(s => s.booked === false);
      const booked = managerSlots.filter(s => s.booked === true);
      // from available slots only keep those which does not overlap with booked
      const validSlots = available.filter(av => isSlotValid(av, booked));
      if (validSlots.length > 0) {
        validManagerSlots[manager] = validSlots;
      }
    }

    // aggregate available slots across managers by normalized start_date where each manager contributes one count available slot start time.
    const aggregate = {};
    for (const manager in validManagerSlots) {
      validManagerSlots[manager].forEach(slot => {
        const key = new Date(slot.start_date).toISOString();
        if (!aggregate[key]) {
          aggregate[key] = new Set();
        }
        aggregate[key].add(manager);
      });
    }

    const finalResult = Object.keys(aggregate)
      .sort()
      .map(start_date => ({
        start_date,
        available_count: aggregate[start_date].size
      }));

    res.json(finalResult);
  } catch (error) {
    console.error("Error in /calendar/query:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;