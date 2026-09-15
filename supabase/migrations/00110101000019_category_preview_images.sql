-- 018_category_preview_images.sql
-- Persist category-scoped preview images scraped from Yupoo category pages

ALTER TABLE discovered_categories
  ADD COLUMN preview_image_urls TEXT[] NOT NULL DEFAULT '{}';
