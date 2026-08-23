-- Allow vault sessions without a team (personal vault-connect recording).
ALTER TABLE sessions ALTER COLUMN team_id DROP NOT NULL;
