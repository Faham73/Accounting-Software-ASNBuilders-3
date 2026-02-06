-- Release Prisma advisory locks
-- Run this if migrations are timing out due to advisory lock issues
-- Usage: Connect to your database and run this SQL

-- List all advisory locks
SELECT 
    locktype, 
    objid, 
    classid, 
    objsubid, 
    virtualtransaction, 
    pid, 
    mode, 
    granted 
FROM pg_locks 
WHERE locktype = 'advisory';

-- Release all advisory locks (use with caution - only if you're sure no other process needs them)
-- SELECT pg_advisory_unlock_all();

-- Or release a specific lock by PID (find the PID from the query above)
-- SELECT pg_terminate_backend(PID_HERE);
