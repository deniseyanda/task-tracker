-- Custom migration: add passwordHash to users (idempotent for MySQL 8+)
-- Uses PREPARE/EXECUTE to skip if the column already exists.
SET @__col_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME   = 'users'
    AND COLUMN_NAME  = 'passwordHash'
);

SET @__stmt = IF(
  @__col_exists > 0,
  'SELECT 1 /* passwordHash already exists, skipping */',
  'ALTER TABLE `users` ADD `passwordHash` varchar(255)'
);

PREPARE __add_pw_hash FROM @__stmt;
EXECUTE __add_pw_hash;
DEALLOCATE PREPARE __add_pw_hash;
