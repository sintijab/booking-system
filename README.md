# Appointment Booking

The web service returns available appointment slots based on customer criteria (date, language, products, and customer rating) and expose the availability through REST API.

Project Structure
```pgsql
├── Dockerfile
├── init.sql
├── optimization.sql
├── index.js
├── package.json
└── README.md
```
- init.sql: Contains the base schema definitions and sample data.
- optimization.sql: Contains production optimizations including view creation and index definitions.
- Dockerfile: Builds a Postgres container and initializes the database using the SQL files.
- index.js: Node/Express application that exposes the /calendar/query endpoint.
- package.json: Node project configuration with necessary dependencies.


## Setup

### Prerequisites

Install Docker, Node.js, npm \
Create .env file and replace with db local environment values

```sh
  POSTGRES_DB=db_name
  POSTGRES_USER=db_user
  POSTGRES_PASSWORD=db_password
  POSTGRES_HOST=localhost
  POSTGRES_PORT=5433
  PORT=3000
```

Open a terminal in the project directory and run:

```bash
cd database
docker build -t appointment-db .
docker rm -f appointment-db
docker run --name appointment-db -p 5433:5432 -d appointment-db
docker ps # verify if container was created
```
Your container will run on port 5433, and Docker has been updated for optimized database setup:
- init.sql initializes the database and preloads it with data
- availability_view.sql optimizations for prod

I created a materialized view availability_view that pre-joins the slots and sales_managers tables and filters out booked slots. GIN indexes are for filtering and querying array fields.

### Development

``` bash
cd test-app
npm install
node index
```

API serves on port 3000, and the endpoint for booking is /calendar/query.

### Endpoints

#### /book
Assign a booking based on desired criteria and desired start time, where transaction with row-level locking prevents concurrent double-booking. \
Expected input:

``` bash
 curl -X POST http://localhost:3000/book \
     -H "Content-Type: application/json" \
     -d '{
           "date": "2024-05-04",
           "products": ["SolarPanels"],
           "language": "German",
           "rating": "Bronze",
           "desired_start_date": "2024-05-04T10:30:00.000Z",
           "customer_id": 123
         }'
```

#### /calendar/query
Retrieves available appointment slots for a specified day by filtering out overlapping or booked slots and count managers that aligns the criteria.
``` bash
curl -X POST http://localhost:3000/calendar/query \
     -H "Content-Type: application/json" \
     -d '{
           "date": "2024-05-04",
           "products": ["SolarPanels"],
           "language": "German",
           "rating": "Bronze"
         }'

```
### Testing
Tests are running with Jest. Contract tests verify that the API returns the expected keys and structure.  Integration tests covers database interactions and business requirements. \

Start the local environment and run all the tests with following test command

```bash
node index
npm run test
```

### Solution

In this solution slots are first sorted and takes O(n log n) time, and then grouped. Sorting through longer list of records is optimal, and then grouping and iteration over groups is linear (O(n)) is even more efficient.
\
We retrieve all slots for the given date and customer criteria - language, rating, products, booking status from the view, then group the returned slots by sales_manager_id and split their slots into available and booked states.
Then for each next available slot validate if it overlaps with any booked slot with the isSlotValid function.
\
Available slots across managers are collected by normalizing their start_date with toISOString() and count how many managers can offer that slot.

### Follow-up improvements

Instead of handling all the logic in application memory it can be done on database level using transactions and row-level locks. For example, using a SQL query with a SELECT ... FOR UPDATE can lock a manager’s availability record while you assign the booking. This prevents race conditions where multiple requests might choose the same manager simultaneously. It is important during the booking process and established through the client database connection pool.
\

For scalable booking system in mid or large organisations in addition to material view require priority queue or scoring algorithm to decide which manager is best suited for a new bookings considering their workload, past bookings and performance ratio. For this priority in booking I added extra column current_load which is updated once booking is done.

### Database optimization

The solution uses uses indices and view to optimize query performance:

#### B-Tree Indices

* idx_slots_start_date on slots table:
    * Speeds up queries filtering or sorting by the start_date column.

* idx_availability_view_start_date on view:
    * Optimizes date-based filtering in the pre-joined view.

#### GIN Indices

* idx_sm_languages on column sales_managers.languages:
    * Improves search when filtering specific language.

* idx_sm_products on column sales_managers.products:
    * Optimizes queries when searching if a sales manager handles specific products.

* idx_sm_customer_ratings on column sales_managers.customer_ratings:
    * Optimizes queries filter by customer ratings.

#### View

Database availability view is created to quickly retrieve relevant records even when the dataset scales to thousands of records.\
It reduces the repetitive joins in queries by pre-joining the slots and sales_managers tables and filtering out booked slotsl, reducing repetitive joins in queries and improving overall query performance.

