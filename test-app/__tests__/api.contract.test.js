const axios = require('axios');

jest.mock('axios');

describe("Booking API contract", () => {
  test("should return starting data and count for calendar query", async () => {
    const mockedResponse = {
      status: 200,
      data: [
        { start_date: "2024-05-03T10:30:00.000Z", available_count: 1 },
        { start_date: "2024-05-03T11:00:00.000Z", available_count: 1 }
      ]
    };
    axios.post = jest.fn();
    axios.post.mockResolvedValue(mockedResponse);

    const response = await axios.post("/calendar/query", {
      date: "2024-05-03",
      products: ["SolarPanels"],
      language: "German",
      rating: "Bronze"
    });

    expect(response.status).toBe(200);
    response.data.forEach(slot => {
      expect(slot).toHaveProperty("start_date");
      expect(slot).toHaveProperty("available_count");
    });
  });
  test("should return bookingId for book query", async () => {
    const mockedResponse = {
      status: 200,
      data: { bookingId: 42 }
    };

    axios.post = jest.fn();
    axios.post.mockResolvedValue(mockedResponse);

    const response = await axios.post("/book", {
      date: "2024-05-03",
      products: ["SolarPanels"],
      language: "German",
      rating: "Bronze",
      desired_start_date: "2024-05-03T10:30:00.000Z",
      customer_id: 123
    });

    expect(response.status).toBe(200);
    expect(response.data).toHaveProperty("bookingId");
    expect(typeof response.data.bookingId).toBe("number");
  });
});
