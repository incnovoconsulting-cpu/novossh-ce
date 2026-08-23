-- Phase 9: Email Template Customization

-- Email templates table: user_id, type, subject, html, is_custom, created_at, updated_at
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  html TEXT NOT NULL,
  is_custom BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, type)
);

CREATE INDEX IF NOT EXISTS idx_email_templates_user_type ON email_templates(user_id, type);
CREATE INDEX IF NOT EXISTS idx_email_templates_type ON email_templates(type);

-- Seed default templates for all notification types
INSERT INTO email_templates (user_id, type, subject, html, is_custom, created_at, updated_at)
VALUES
  (
    NULL,
    'trial_expiring',
    'Your NovoSSH trial expires in {{daysRemaining}} days',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
    .button { background: #fa709a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
    .footer { color: #999; font-size: 12px; margin-top: 20px; }
    .highlight { background: #fff3cd; padding: 12px; border-radius: 6px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Your trial expires soon</h1>
    </div>
    <div class="content">
      <p>Your NovoSSH trial will expire on <strong>{{expirationDate}}</strong> (in {{daysRemaining}} days).</p>
      <div class="highlight">
        <p><strong>Don''t lose access!</strong> Update your billing information to keep using NovoSSH.</p>
      </div>
      <a href="{{upgradeUrl}}" class="button">Update Billing</a>
      <p style="color: #666;">After your trial expires, you''ll need an active subscription to continue using all features.</p>
      <div class="footer">
        <p>© NovoSSH. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>',
    FALSE,
    NOW(),
    NOW()
  ),
  (
    NULL,
    'plan_downgrade',
    'Your NovoSSH plan has been downgraded to {{newPlan}}',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
    .button { background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
    .footer { color: #999; font-size: 12px; margin-top: 20px; }
    .warning { color: #d32f2f; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Plan Downgrade Confirmed</h1>
    </div>
    <div class="content">
      <p>Your NovoSSH subscription has been downgraded from <strong>{{previousPlan}}</strong> to <strong>{{newPlan}}</strong>.</p>
      <p class="warning"><strong>Exceeded Resources:</strong></p>
      <p>{{exceededResources}}</p>
      <p>You can continue using these resources, but you won''t be able to create new ones until within the limit.</p>
      <a href="{{billingUrl}}" class="button">View Your Plan</a>
      <div class="footer">
        <p>© NovoSSH. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>',
    FALSE,
    NOW(),
    NOW()
  ),
  (
    NULL,
    'payment_failed',
    'Payment failed for your NovoSSH subscription',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #f5576c 0%, #fa709a 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
    .button { background: #f5576c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
    .footer { color: #999; font-size: 12px; margin-top: 20px; }
    .alert { background: #ffebee; padding: 12px; border-radius: 6px; color: #d32f2f; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Payment Failed</h1>
    </div>
    <div class="content">
      <div class="alert">
        <p><strong>Your payment of {{amount}} failed.</strong></p>
      </div>
      <p>We couldn''t process your payment. Please update your billing information to avoid service interruption.</p>
      <a href="{{retryUrl}}" class="button">Retry Payment</a>
      <p>If you need assistance, please <a href="{{supportUrl}}">contact support</a>.</p>
      <div class="footer">
        <p>© NovoSSH. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>',
    FALSE,
    NOW(),
    NOW()
  ),
  (
    NULL,
    'storage_warning',
    'You''re approaching your storage limit',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
    .button { background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
    .footer { color: #999; font-size: 12px; margin-top: 20px; }
    .progress { background: #e0e0e0; height: 8px; border-radius: 4px; margin: 20px 0; }
    .progress-bar { background: #667eea; height: 100%; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Storage Warning</h1>
    </div>
    <div class="content">
      <p>You''re using {{usedStorage}} of your {{limitStorage}} storage limit.</p>
      <div class="progress">
        <div class="progress-bar" style="width: {{storagePercentage}}%;"></div>
      </div>
      <p>Consider upgrading your plan to get more storage.</p>
      <a href="{{upgradeUrl}}" class="button">Upgrade Plan</a>
      <div class="footer">
        <p>© NovoSSH. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>',
    FALSE,
    NOW(),
    NOW()
  ),
  (
    NULL,
    'feature_announcement',
    'New feature in NovoSSH: {{featureTitle}}',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
    .button { background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
    .footer { color: #999; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>{{featureTitle}}</h1>
    </div>
    <div class="content">
      <p>{{description}}</p>
      <a href="{{docsUrl}}" class="button">Learn More</a>
      <div class="footer">
        <p>© NovoSSH. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>',
    FALSE,
    NOW(),
    NOW()
  ),
  (
    NULL,
    'security_alert',
    'Security Alert: {{alertType}}',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #f5576c 0%, #fa709a 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 20px; border-radius: 0 0 8px 8px; }
    .button { background: #f5576c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0; }
    .footer { color: #999; font-size: 12px; margin-top: 20px; }
    .alert { background: #ffebee; padding: 12px; border-radius: 6px; color: #d32f2f; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Security Alert</h1>
    </div>
    <div class="content">
      <div class="alert">
        <p><strong>{{alertType}}</strong></p>
      </div>
      <p>Timestamp: {{timestamp}}</p>
      <p>Please review this security alert and take any necessary action.</p>
      <a href="{{actionUrl}}" class="button">Take Action</a>
      <div class="footer">
        <p>© NovoSSH. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>',
    FALSE,
    NOW(),
    NOW()
  )
ON CONFLICT DO NOTHING;
