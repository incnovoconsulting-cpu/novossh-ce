-- Phase 15: Add unique constraint on ssh_hosts(user_id, address, port, username)
-- Enables true cross-platform deduplication when the same host exists under different UUIDs.

-- First remove duplicate rows, keeping the most recently updated one per user+address+port+username.
DELETE FROM ssh_hosts
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, address, port, username) id
  FROM ssh_hosts
  ORDER BY user_id, address, port, username, updated_at DESC
);

ALTER TABLE ssh_hosts
  ADD CONSTRAINT uq_ssh_hosts_user_address UNIQUE (user_id, address, port, username);

-- Similarly deduplicate user_snippets by command per user.
DELETE FROM user_snippets
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id, command) id
  FROM user_snippets
  ORDER BY user_id, command, created_at DESC
);

ALTER TABLE user_snippets
  ADD CONSTRAINT uq_user_snippets_user_command UNIQUE (user_id, command);
