-- T18 analytics aggregation backend (ADR-0027). Three materialized views,
-- one per transactional fact table (sales/enquiries/recommendations),
-- denormalizing the district/ULB/category/product/SHG/buyer joins that
-- would otherwise be repeated on every dashboard query. Dimension tables
-- themselves (SHG/Product/Buyer) are tiny (single digits today) and are
-- rolled up live against these views rather than materialized separately —
-- see ADR-0027 for why.
--
-- Each view has a unique index on its own fact id so
-- `REFRESH MATERIALIZED VIEW CONCURRENTLY` can be used (avoids locking out
-- dashboard reads while a refresh runs).

CREATE MATERIALIZED VIEW mv_sales_facts AS
SELECT
    s.id AS sale_id,
    s.sale_date,
    s.quantity,
    s.unit_price,
    s.total_amount,
    s.product_id,
    p.name AS product_name,
    p.category_id,
    c.name AS category_name,
    s.shg_id,
    shg.name AS shg_name,
    s.district_id,
    d.name AS district_name,
    shg.ulb_id,
    u.name AS ulb_name,
    s.buyer_id
FROM sales s
JOIN products p ON p.id = s.product_id
JOIN categories c ON c.id = p.category_id
JOIN shg ON shg.id = s.shg_id
JOIN districts d ON d.id = s.district_id
LEFT JOIN ulbs u ON u.id = shg.ulb_id;

CREATE UNIQUE INDEX mv_sales_facts_sale_id_idx ON mv_sales_facts (sale_id);
CREATE INDEX mv_sales_facts_district_idx ON mv_sales_facts (district_id);
CREATE INDEX mv_sales_facts_ulb_idx ON mv_sales_facts (ulb_id);
CREATE INDEX mv_sales_facts_category_idx ON mv_sales_facts (category_id);
CREATE INDEX mv_sales_facts_shg_idx ON mv_sales_facts (shg_id);
CREATE INDEX mv_sales_facts_product_idx ON mv_sales_facts (product_id);
CREATE INDEX mv_sales_facts_sale_date_idx ON mv_sales_facts (sale_date);

CREATE MATERIALIZED VIEW mv_enquiry_facts AS
SELECT
    e.id AS enquiry_id,
    e.created_at,
    e.status,
    e.buyer_id,
    b.name AS buyer_name,
    e.shg_id,
    shg.name AS shg_name,
    shg.district_id,
    d.name AS district_name,
    shg.ulb_id,
    u.name AS ulb_name,
    e.product_id,
    p.name AS product_name,
    p.category_id,
    c.name AS category_name
FROM enquiries e
JOIN buyers b ON b.id = e.buyer_id
JOIN shg ON shg.id = e.shg_id
JOIN districts d ON d.id = shg.district_id
LEFT JOIN ulbs u ON u.id = shg.ulb_id
LEFT JOIN products p ON p.id = e.product_id
LEFT JOIN categories c ON c.id = p.category_id;

CREATE UNIQUE INDEX mv_enquiry_facts_enquiry_id_idx ON mv_enquiry_facts (enquiry_id);
CREATE INDEX mv_enquiry_facts_district_idx ON mv_enquiry_facts (district_id);
CREATE INDEX mv_enquiry_facts_ulb_idx ON mv_enquiry_facts (ulb_id);
CREATE INDEX mv_enquiry_facts_shg_idx ON mv_enquiry_facts (shg_id);
CREATE INDEX mv_enquiry_facts_buyer_idx ON mv_enquiry_facts (buyer_id);
CREATE INDEX mv_enquiry_facts_status_idx ON mv_enquiry_facts (status);
CREATE INDEX mv_enquiry_facts_created_at_idx ON mv_enquiry_facts (created_at);

CREATE MATERIALIZED VIEW mv_recommendation_facts AS
SELECT
    r.id AS recommendation_id,
    r.created_at,
    r.responded_at,
    r.status,
    r.match_score,
    r.expected_demand,
    r.shg_id,
    shg.name AS shg_name,
    shg.district_id,
    d.name AS district_name,
    shg.ulb_id,
    u.name AS ulb_name,
    r.buyer_id,
    b.name AS buyer_name,
    b.type AS buyer_type,
    r.product_id,
    p.name AS product_name,
    p.category_id,
    c.name AS category_name
FROM recommendations r
JOIN shg ON shg.id = r.shg_id
JOIN districts d ON d.id = shg.district_id
LEFT JOIN ulbs u ON u.id = shg.ulb_id
JOIN buyers b ON b.id = r.buyer_id
LEFT JOIN products p ON p.id = r.product_id
LEFT JOIN categories c ON c.id = p.category_id;

CREATE UNIQUE INDEX mv_recommendation_facts_id_idx ON mv_recommendation_facts (recommendation_id);
CREATE INDEX mv_recommendation_facts_district_idx ON mv_recommendation_facts (district_id);
CREATE INDEX mv_recommendation_facts_ulb_idx ON mv_recommendation_facts (ulb_id);
CREATE INDEX mv_recommendation_facts_shg_idx ON mv_recommendation_facts (shg_id);
CREATE INDEX mv_recommendation_facts_buyer_idx ON mv_recommendation_facts (buyer_id);
CREATE INDEX mv_recommendation_facts_status_idx ON mv_recommendation_facts (status);
CREATE INDEX mv_recommendation_facts_created_at_idx ON mv_recommendation_facts (created_at);
