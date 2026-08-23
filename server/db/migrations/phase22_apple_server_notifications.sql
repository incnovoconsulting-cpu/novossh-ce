-- Apple App Store Server Notifications support.
-- Store the original transaction id from StoreKit purchases so App Store Server
-- Notifications V2 (renew / cancel / expire / refund) can be mapped back to a user.
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS apple_original_transaction_id VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_subscriptions_apple_otid
  ON subscriptions(apple_original_transaction_id);
