DROP MATERIALIZED VIEW IF EXISTS availability_view;

CREATE MATERIALIZED VIEW availability_view AS
SELECT
    s.id,
    s.start_date,
    s.end_date,
    s.booked,
    s.sales_manager_id,
    sm.languages,
    sm.products,
    sm.customer_ratings
FROM slots s
JOIN sales_managers sm ON s.sales_manager_id = sm.id;

CREATE INDEX IF NOT EXISTS idx_availability_view_start_date ON availability_view (start_date);
CREATE INDEX IF NOT EXISTS idx_slots_start_date ON slots (start_date);
CREATE INDEX IF NOT EXISTS idx_sm_languages ON sales_managers USING GIN (languages);
CREATE INDEX IF NOT EXISTS idx_sm_products ON sales_managers USING GIN (products);
CREATE INDEX IF NOT EXISTS idx_sm_customer_ratings ON sales_managers USING GIN (customer_ratings);
