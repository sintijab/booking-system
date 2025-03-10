import express from "express";
import { Pool } from "pg";
import bodyParser from "body-parser";

// Create an Express app and middleware
const app = express();
app.use(bodyParser.json());

// Create a pg Pool instance using an environment variable or default connection string.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/postgres",
});

// Helper to determine if two slots overlap (slots are one hour; overlap if startA < endB and startB < endA)
function slotsOverlap(slotA, slotB) {
  const startA = new Date(slotA.start_date).getTime();
  const endA = new Date(slotA.end_date).getTime();
  const startB = new Date(slotB.start_date).getTime();
  const endB = new Date(slotB.end_date).getTime();
  return startA < endB && startB < endA;
}

// If slots are overlapping choose one candidate slot
// If only one manager qualifies then return all available slots
function resolveOverlapping(slots, slotsByManagerCount, slotsByAvailability) {
  if (slots.length === 0) return [];
  if (slotsByManagerCount === 1) return slots;

  slots.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

  const groups = [];
  let currentGroup = [slots[0]];

  for (let i = 1; i < slots.length; i++) {
    const prev = currentGroup[currentGroup.length - 1];
    const curr = slots[i];
    if (slotsOverlap(prev, curr)) {
      currentGroup.push(curr);
    } else {
      groups.push(currentGroup);
      currentGroup = [curr];
    }
  }
  groups.push(currentGroup);

  // For overlapping groups select the candidate slot whose start_date based on overall availability is highest or with the later start_date
  const result = [];
  groups.forEach(group => {
    if (group.length === 1) {
      result.push(group[0]);
    } else {
      let candidate = group[0];
      let candidateCount = slotsByAvailability[candidate.start_date] || 0;
      for (let slot of group) {
        const count = slotsByAvailability[slot.start_date] || 0;
        if (count > candidateCount || (count === candidateCount && new Date(slot.start_date) > new Date(candidate.start_date))) {
          candidate = slot;
          candidateCount = count;
        }
      }
      result.push(candidate);
    }
  });
  return result;
}

app.post("/calendar/query", async (req, res) => {
  try {
    const { date, products, language, rating } = req.body;
    if (!date || !products || !language || !rating) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const queryText = `
      SELECT id, start_date, end_date, sales_manager_id
      FROM availability_view
      WHERE start_date::date = $1
        AND $2 = ANY(languages)
        AND $3 = ANY(customer_ratings)
        AND products @> $4::varchar[]
      ORDER BY start_date;
    `;
    const values = [date, language, rating, JSON.stringify(products)];
    const { rows } = await pool.query(queryText, values);

    if (rows.length === 0) {
      return res.json([]);
    }

    // Frequency of start date for how many slots from any manager share the same normalized start time
    const slotsByAvailability = {};
    rows.forEach(slot => {
      const key = new Date(slot.start_date).toISOString();
      slotsByAvailability[key] = (slotsByAvailability[key] || 0) + 1;
      slot.start_date = key;
    });

    // Grouping slots by how many managers qualify overall with sales_manager_id 
    const slotsByManager = {};
    rows.forEach(slot => {
      if (!slotsByManager[slot.sales_manager_id]) {
        slotsByManager[slot.sales_manager_id] = [];
      }
      slotsByManager[slot.sales_manager_id].push(slot);
    });
    const slotsByManagerCount = Object.keys(slotsByManager).length;

    // Resolve overlapping slots for each sales manager
    const resolvedSlots = [];
    Object.values(slotsByManager).forEach(managerSlots => {
      const chosen = resolveOverlapping(managerSlots, slotsByManagerCount, slotsByAvailability);
      resolvedSlots.push(...chosen);
    });

    // Aggregate by start_date across all managers
    const aggregate = {};
    resolvedSlots.forEach(slot => {
      aggregate[slot.start_date] = (aggregate[slot.start_date] || 0) + 1;
    });

    const finalResult = Object.keys(aggregate)
      .sort()
      .map(start_date => ({
        start_date,
        available_count: aggregate[start_date]
      }));
      
    return res.json(finalResult);
  } catch (error) {
    console.error("Error in /calendar/query:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});