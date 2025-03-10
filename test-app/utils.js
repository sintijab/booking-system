const pool = require("./db");

// Convert a JavaScript array into a PostgreSQL array literal.
const pgArray = (arr) => `{${arr.join(",")}}`;

// Check if two slots overlap based on their start and end times.
const slotsOverlap = (a, b) => {
  const startA = new Date(a.start_date).getTime();
  const endA = new Date(a.end_date).getTime();
  const startB = new Date(b.start_date).getTime();
  const endB = new Date(b.end_date).getTime();
  return startA < endB && startB < endA;
};

// Determine if an available slot does not conflict with any booked slot.
const isSlotValid = (availableSlot, bookedSlots) => {
  return bookedSlots.every(booked => !slotsOverlap(availableSlot, booked));
};


/**
 * assignBooking is the assignment of a booking request to manager.
 * It uses a transaction and a SELECT ... FOR UPDATE query to lock the manager record.
 */
async function assignBooking(bookingDetails) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const selectQuery = `
      SELECT s.id, s.start_date, s.end_date, s.booked, s.sales_manager_id,
             sm.languages, sm.products, sm.customer_ratings
      FROM slots s
      JOIN sales_managers sm ON s.sales_manager_id = sm.id
      WHERE s.start_date::date = $1
        AND $2 = ANY(sm.languages)
        AND $3 = ANY(sm.customer_ratings)
        AND sm.products @> $4::varchar[]
      ORDER BY s.sales_manager_id, s.start_date
      FOR UPDATE;
    `;
    const productsLiteral = pgArray(bookingDetails.products);
    const selectResult = await client.query(selectQuery, [
      bookingDetails.date,
      bookingDetails.language,
      bookingDetails.rating,
      productsLiteral,
    ]);

    if (selectResult.rows.length === 0) {
      throw new Error("No available manager matching criteria");
    }
    
    // group the slots by manager
    const slotsByManager = {};
    selectResult.rows.forEach(slot => {
      if (!slotsByManager[slot.sales_manager_id]) {
        slotsByManager[slot.sales_manager_id] = [];
      }
      slotsByManager[slot.sales_manager_id].push(slot);
    });
    
    // for each manager separate available and booked slots
    const validManagerSlots = {};
    for (const manager in slotsByManager) {
      const managerSlots = slotsByManager[manager];
      const available = managerSlots.filter(s => s.booked === false);
      const booked = managerSlots.filter(s => s.booked === true);
      const validSlots = available.filter(av => booked.every(bookedSlot => !slotsOverlap(av, bookedSlot)));
      if (validSlots.length > 0) {
        validManagerSlots[manager] = validSlots.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));
      }
    }
    
    // find a candidate slot matching the desired_start_date
    const desiredKey = new Date(bookingDetails.desired_start_date).toISOString();
    let chosenSlot = null;
    for (const manager in validManagerSlots) {
      const candidate = validManagerSlots[manager].find(slot => new Date(slot.start_date).toISOString() === desiredKey);
      if (candidate) {
        chosenSlot = candidate;
        break;
      }
    }
    
    if (!chosenSlot || !chosenSlot.start_date) {
      await client.query("ROLLBACK");
      throw new Error("No valid slot found with a proper start_date");
    }
    
    // mark the selected slot as booked
    const updateQuery = `UPDATE slots SET booked = true WHERE id = $1;`;
    await client.query(updateQuery, [chosenSlot.id]);
    
    // insert a record into bookings table
    const insertQuery = `
      INSERT INTO bookings (sales_manager_id, start_date, end_date, customer_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id;
    `;
    const insertResult = await client.query(insertQuery, [
      chosenSlot.sales_manager_id,
      chosenSlot.start_date,
      chosenSlot.end_date,
      bookingDetails.customer_id,
    ]);
    const bookingId = insertResult.rows[0].id;
    
    // update the manager's load
    const updateLoadQuery = `UPDATE sales_managers SET current_load = current_load + 1 WHERE id = $1;`;
    await client.query(updateLoadQuery, [chosenSlot.sales_manager_id]);
    
    await client.query("COMMIT");
    return bookingId;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    if (client) client.release();
  }
}

module.exports = { pgArray, slotsOverlap, isSlotValid, assignBooking };
