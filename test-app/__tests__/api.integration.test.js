const axios = require("axios");

jest.setTimeout(600000);

const tests = [
  [
    "Monday 2024-05-03, Solar Panels and Heatpumps, German and Gold customer. Only Seller 2 is selectable.",
    {
      input: {
        "date": "2024-05-03",
        "products": ["SolarPanels", "Heatpumps"],
        "language": "German",
        "rating": "Gold"
      },
      expectedResult: [
        { "start_date": "2024-05-03T10:30:00.000Z", "available_count": 1 },
        { "start_date": "2024-05-03T11:00:00.000Z", "available_count": 1 },
        { "start_date": "2024-05-03T11:30:00.000Z", "available_count": 1 },
      ]
    }
  ],
  [
    "Monday 2024-05-03, Heatpumps, English and Silver customer. Both Seller 2 and Seller 3 are selectable.",
    {
      input: {
        "date": "2024-05-03",
        "products": ["Heatpumps"],
        "language": "English",
        "rating": "Silver"
      },
      expectedResult: [
        { "start_date": "2024-05-03T10:30:00.000Z", "available_count": 1 },
        { "start_date": "2024-05-03T11:00:00.000Z", "available_count": 1 },
        { "start_date": "2024-05-03T11:30:00.000Z", "available_count": 2 },
      ]
    }
  ],
  [
    "Monday 2024-05-03, SolarPanels, German and Bronze customer. All Seller 1 and 2 are selectable, but Seller 1 does not have available slots.",
    {
      input: {
        "date": "2024-05-03",
        "products": ["SolarPanels"],
        "language": "German",
        "rating": "Bronze"
      },
      expectedResult: [
        { "start_date": "2024-05-03T10:30:00.000Z", "available_count": 1 },
        { "start_date": "2024-05-03T11:00:00.000Z", "available_count": 1 },
        { "start_date": "2024-05-03T11:30:00.000Z", "available_count": 1 },
      ]
    }
  ],
  [
    "Tuesday 2024-05-04, Solar Panels and Heatpumps, German and Gold customer. Only Seller 2 is selectable, but it is fully booked",
    {
      input: {
        "date": "2024-05-04",
        "products": ["SolarPanels", "Heatpumps"],
        "language": "German",
        "rating": "Gold"
      },
      expectedResult: []
    }
  ],
  [
    "Tuesday 2024-05-04, Heatpumps, English and Silver customer. Both Seller 2 and Seller 3 are selectable, but Seller 2 is fully booked.",
    {
      input: {
        "date": "2024-05-04",
        "products": ["Heatpumps"],
        "language": "English",
        "rating": "Silver"
      },
      expectedResult: [
        { "start_date": "2024-05-04T11:30:00.000Z", "available_count": 1 },
      ]
    }
  ],
  [
    "Monday 2024-05-03, SolarPanels, German and Bronze customer. Seller 1 and 2 are selectable, but Seller 2 is fully booked",
    {
      input: {
        "date": "2024-05-04",
        "products": ["SolarPanels"],
        "language": "German",
        "rating": "Bronze"
      },
      expectedResult: [
        { "start_date": "2024-05-04T10:30:00.000Z", "available_count": 1 },
      ]
    }
  ],
];

describe("Coding challenge calendar tests", () => {
  test.each(tests)(
    "%s",
    async (_, test_data) => {
      const response = await axios.post("http://localhost:3000/calendar/query", test_data.input);
      expect(response.status).toBe(200);
      expect(response.data.length).toBe(test_data.expectedResult.length);

      for (let i = 0; i < test_data.expectedResult.length; i++) {
        expect(response.data[i].available_count).toBe(test_data.expectedResult[i].available_count);
        expect(response.data[i].start_date).toBe(test_data.expectedResult[i].start_date);
      }
    }
  );
});
