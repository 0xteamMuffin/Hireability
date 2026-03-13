-- Fix template1 collation version mismatch (run as postgres superuser)
-- After a system/glibc upgrade, template1 can have an outdated collation version.
ALTER DATABASE template1 REFRESH COLLATION VERSION;
