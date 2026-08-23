/**
 * Environment Configuration and Validation
 * Validates and provides type-safe access to all environment variables
 */

export interface ServerConfig {
  port: number;
  host: string;
  nodeEnv: 'production' | 'staging' | 'development';
  serviceVersion: string;
  trustProxy: number | boolean;
  maxRequestSize: string;
}

export interface DatabaseConfig {
  url: string;
  poolSize: number;
  poolIdleTimeout: number;
  poolReapInterval: number;
  poolConnectionTimeout: number;
  sslMode: 'disable' | 'allow' | 'prefer' | 'require' | 'verify-ca' | 'verify-full';
  sslCertPath?: string;
  sslKeyPath?: string;
  sslCaPath?: string;
}

export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
  bcryptCost: number;
  sessionTimeout: number;
}

export interface CorsConfig {
  allowedOrigins: string[];
  allowCredentials: boolean;
}

export interface RateLimitConfig {
  requestsPerWindow: number;
  windowMs: number;
  authRequestsPerWindow: number;
  authWindowMs: number;
}

export interface LoggingConfig {
  level: 'error' | 'warn' | 'info' | 'debug' | 'trace';
  format: 'json' | 'text';
  requestLogging: boolean;
}

export interface MonitoringConfig {
  enabled: boolean;
  healthCheckEnabled: boolean;
  healthCheckIntervalMs: number;
  metricsEnabled: boolean;
  memoryThresholdCritical: number;
  memoryThresholdDegraded: number;
  dbResponseTimeDegraded: number;
  dbResponseTimeUnhealthy: number;
}

export interface GracefulShutdownConfig {
  gracePeriodMs: number;
  forceTimeoutMs: number;
  maxInFlightRequests: number;
}

export interface SshConfig {
  timeoutMs: number;
  keepaliveIntervalMs: number;
  maxConnectionsPerUser: number;
  maxConcurrentOps: number;
}

export interface FeatureFlags {
  offlineSync: boolean;
  p2pSync: boolean;
  sessionRecording: boolean;
  portForwarding: boolean;
}

export interface Config {
  server: ServerConfig;
  database: DatabaseConfig;
  auth: AuthConfig;
  cors: CorsConfig;
  rateLimit: RateLimitConfig;
  logging: LoggingConfig;
  monitoring: MonitoringConfig;
  gracefulShutdown: GracefulShutdownConfig;
  ssh: SshConfig;
  features: FeatureFlags;
  debug: boolean;
  enableProfiling: boolean;
  requestIdHeader: string;
  maxInFlightRequests: number;
}

/**
 * Validation errors for environment variables
 */
export class ConfigValidationError extends Error {
  constructor(
    public readonly field: string,
    public readonly value: unknown,
    message: string
  ) {
    super(`Configuration error for ${field}: ${message}`);
    this.name = 'ConfigValidationError';
  }
}

function parseInteger(value: string | undefined, fieldName: string, defaultValue?: number): number {
  if (value === undefined) {
    if (defaultValue !== undefined) return defaultValue;
    throw new ConfigValidationError(fieldName, value, 'Required field is missing');
  }

  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new ConfigValidationError(fieldName, value, `Expected integer, got "${value}"`);
  }
  return parsed;
}

function parsePositiveInteger(
  value: string | undefined,
  fieldName: string,
  defaultValue?: number
): number {
  const parsed = parseInteger(value, fieldName, defaultValue);
  if (parsed <= 0) {
    throw new ConfigValidationError(fieldName, value, `Expected positive integer, got ${parsed}`);
  }
  return parsed;
}

function parsePercentage(
  value: string | undefined,
  fieldName: string,
  defaultValue?: number
): number {
  const parsed = parseInteger(value, fieldName, defaultValue);
  if (parsed < 0 || parsed > 100) {
    throw new ConfigValidationError(fieldName, value, `Expected percentage (0-100), got ${parsed}`);
  }
  return parsed;
}

function parseBoolean(
  value: string | undefined,
  fieldName: string,
  defaultValue?: boolean
): boolean {
  if (value === undefined) {
    if (defaultValue !== undefined) return defaultValue;
    throw new ConfigValidationError(fieldName, value, 'Required field is missing');
  }

  const lower = value.toLowerCase();
  if (lower === 'true' || lower === '1' || lower === 'yes') return true;
  if (lower === 'false' || lower === '0' || lower === 'no') return false;

  throw new ConfigValidationError(fieldName, value, `Expected boolean (true/false), got "${value}"`);
}

function parseStringList(
  value: string | undefined,
  fieldName: string,
  defaultValue?: string[]
): string[] {
  if (value === undefined) {
    if (defaultValue !== undefined) return defaultValue;
    throw new ConfigValidationError(fieldName, value, 'Required field is missing');
  }

  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function validateJwtSecret(secret: string): void {
  if (secret.length < 32) {
    throw new ConfigValidationError(
      'JWT_SECRET',
      '***',
      `JWT_SECRET must be at least 32 characters long (got ${secret.length})`
    );
  }

  const hasUpperCase = /[A-Z]/.test(secret);
  const hasLowerCase = /[a-z]/.test(secret);
  const hasNumbers = /\d/.test(secret);
  const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};:'",.<>?/\\|`~]/.test(secret);

  const complexity = [hasUpperCase, hasLowerCase, hasNumbers, hasSpecialChars].filter(
    Boolean
  ).length;

  if (complexity < 3) {
    throw new ConfigValidationError(
      'JWT_SECRET',
      '***',
      'JWT_SECRET should contain mix of uppercase, lowercase, numbers, and special characters'
    );
  }
}

/**
 * Load and validate all configuration from environment variables
 * Throws ConfigValidationError if any validation fails
 */
export function loadConfig(): Config {
  const errors: ConfigValidationError[] = [];

  const getEnv = (key: string) => process.env[key];


  let server: ServerConfig;
  try {
    server = {
      port: parsePositiveInteger(getEnv('PORT'), 'PORT', 8787),
      host: getEnv('HOST') || '0.0.0.0',
      nodeEnv:
        (getEnv('NODE_ENV') as 'production' | 'staging' | 'development') || 'development',
      serviceVersion: getEnv('SERVICE_VERSION') || '0.1.0',
      trustProxy: parseBoolean(getEnv('TRUST_PROXY'), 'TRUST_PROXY', false) ? 1 : 0,
      maxRequestSize: getEnv('MAX_REQUEST_SIZE') || '2mb',
    };
  } catch (error) {
    if (error instanceof ConfigValidationError) errors.push(error);
    throw error;
  }


  let database: DatabaseConfig;
  try {
    const dbUrl = getEnv('DATABASE_URL');
    if (!dbUrl) {
      throw new ConfigValidationError(
        'DATABASE_URL',
        undefined,
        'Required field is missing'
      );
    }

    database = {
      url: dbUrl,
      poolSize: parsePositiveInteger(getEnv('DB_POOL_SIZE'), 'DB_POOL_SIZE', 20),
      poolIdleTimeout: parsePositiveInteger(
        getEnv('DB_POOL_IDLE_TIMEOUT'),
        'DB_POOL_IDLE_TIMEOUT',
        30000
      ),
      poolReapInterval: parsePositiveInteger(
        getEnv('DB_POOL_REAP_INTERVAL'),
        'DB_POOL_REAP_INTERVAL',
        1000
      ),
      poolConnectionTimeout: parsePositiveInteger(
        getEnv('DB_POOL_CONNECTION_TIMEOUT'),
        'DB_POOL_CONNECTION_TIMEOUT',
        10000
      ),
      sslMode:
        (getEnv('DB_SSL_MODE') as
          | 'disable'
          | 'allow'
          | 'prefer'
          | 'require'
          | 'verify-ca'
          | 'verify-full') || 'require',
      sslCertPath: getEnv('DB_SSL_CERT_PATH'),
      sslKeyPath: getEnv('DB_SSL_KEY_PATH'),
      sslCaPath: getEnv('DB_SSL_CA_PATH'),
    };
  } catch (error) {
    if (error instanceof ConfigValidationError) errors.push(error);
    throw error;
  }


  let auth: AuthConfig;
  try {
    const jwtSecret = getEnv('JWT_SECRET');
    if (!jwtSecret) {
      throw new ConfigValidationError(
        'JWT_SECRET',
        undefined,
        'Required field is missing'
      );
    }

    validateJwtSecret(jwtSecret);

    auth = {
      jwtSecret,
      jwtExpiresIn: getEnv('JWT_EXPIRES_IN') || '24h',
      bcryptCost: parseInteger(getEnv('BCRYPT_COST'), 'BCRYPT_COST', 12),
      sessionTimeout: parsePositiveInteger(
        getEnv('SESSION_TIMEOUT'),
        'SESSION_TIMEOUT',
        86400000
      ),
    };

    if (auth.bcryptCost < 10 || auth.bcryptCost > 14) {
      throw new ConfigValidationError(
        'BCRYPT_COST',
        auth.bcryptCost,
        'BCRYPT_COST should be between 10 and 14'
      );
    }
  } catch (error) {
    if (error instanceof ConfigValidationError) errors.push(error);
    throw error;
  }


  let cors: CorsConfig;
  try {
    cors = {
      allowedOrigins: parseStringList(
        getEnv('ALLOWED_ORIGINS'),
        'ALLOWED_ORIGINS',
        ['http://localhost:5173', 'http://localhost:3000']
      ),
      allowCredentials: parseBoolean(getEnv('ALLOW_CREDENTIALS'), 'ALLOW_CREDENTIALS', true),
    };
  } catch (error) {
    if (error instanceof ConfigValidationError) errors.push(error);
    throw error;
  }


  let rateLimit: RateLimitConfig;
  try {
    rateLimit = {
      requestsPerWindow: parsePositiveInteger(
        getEnv('RATE_LIMIT_REQUESTS'),
        'RATE_LIMIT_REQUESTS',
        1000
      ),
      windowMs: parsePositiveInteger(
        getEnv('RATE_LIMIT_WINDOW'),
        'RATE_LIMIT_WINDOW',
        900000
      ),
      authRequestsPerWindow: parsePositiveInteger(
        getEnv('AUTH_RATE_LIMIT_REQUESTS'),
        'AUTH_RATE_LIMIT_REQUESTS',
        5
      ),
      authWindowMs: parsePositiveInteger(
        getEnv('AUTH_RATE_LIMIT_WINDOW'),
        'AUTH_RATE_LIMIT_WINDOW',
        900000
      ),
    };
  } catch (error) {
    if (error instanceof ConfigValidationError) errors.push(error);
    throw error;
  }


  let logging: LoggingConfig;
  try {
    logging = {
      level:
        (getEnv('LOG_LEVEL') as 'error' | 'warn' | 'info' | 'debug' | 'trace') || 'info',
      format: (getEnv('LOG_FORMAT') as 'json' | 'text') || 'json',
      requestLogging: parseBoolean(getEnv('REQUEST_LOGGING'), 'REQUEST_LOGGING', true),
    };
  } catch (error) {
    if (error instanceof ConfigValidationError) errors.push(error);
    throw error;
  }


  let monitoring: MonitoringConfig;
  try {
    monitoring = {
      enabled: parseBoolean(getEnv('HEALTH_CHECK_ENABLED'), 'HEALTH_CHECK_ENABLED', true),
      healthCheckEnabled: parseBoolean(
        getEnv('HEALTH_CHECK_ENABLED'),
        'HEALTH_CHECK_ENABLED',
        true
      ),
      healthCheckIntervalMs: parsePositiveInteger(
        getEnv('HEALTH_CHECK_INTERVAL'),
        'HEALTH_CHECK_INTERVAL',
        30000
      ),
      metricsEnabled: parseBoolean(getEnv('METRICS_ENABLED'), 'METRICS_ENABLED', true),
      memoryThresholdCritical: parsePercentage(
        getEnv('MEMORY_THRESHOLD_CRITICAL'),
        'MEMORY_THRESHOLD_CRITICAL',
        90
      ),
      memoryThresholdDegraded: parsePercentage(
        getEnv('MEMORY_THRESHOLD_DEGRADED'),
        'MEMORY_THRESHOLD_DEGRADED',
        75
      ),
      dbResponseTimeDegraded: parsePositiveInteger(
        getEnv('DB_RESPONSE_TIME_DEGRADED'),
        'DB_RESPONSE_TIME_DEGRADED',
        1000
      ),
      dbResponseTimeUnhealthy: parsePositiveInteger(
        getEnv('DB_RESPONSE_TIME_UNHEALTHY'),
        'DB_RESPONSE_TIME_UNHEALTHY',
        5000
      ),
    };
  } catch (error) {
    if (error instanceof ConfigValidationError) errors.push(error);
    throw error;
  }


  let gracefulShutdown: GracefulShutdownConfig;
  try {
    gracefulShutdown = {
      gracePeriodMs: parsePositiveInteger(
        getEnv('SHUTDOWN_GRACE_PERIOD'),
        'SHUTDOWN_GRACE_PERIOD',
        30000
      ),
      forceTimeoutMs: parsePositiveInteger(
        getEnv('SHUTDOWN_FORCE_TIMEOUT'),
        'SHUTDOWN_FORCE_TIMEOUT',
        60000
      ),
      maxInFlightRequests: parsePositiveInteger(
        getEnv('MAX_IN_FLIGHT_REQUESTS'),
        'MAX_IN_FLIGHT_REQUESTS',
        10000
      ),
    };
  } catch (error) {
    if (error instanceof ConfigValidationError) errors.push(error);
    throw error;
  }


  let ssh: SshConfig;
  try {
    ssh = {
      timeoutMs: parsePositiveInteger(getEnv('SSH_TIMEOUT'), 'SSH_TIMEOUT', 30000),
      keepaliveIntervalMs: parsePositiveInteger(
        getEnv('SSH_KEEPALIVE_INTERVAL'),
        'SSH_KEEPALIVE_INTERVAL',
        30000
      ),
      maxConnectionsPerUser: parsePositiveInteger(
        getEnv('MAX_SSH_CONNECTIONS_PER_USER'),
        'MAX_SSH_CONNECTIONS_PER_USER',
        10
      ),
      maxConcurrentOps: parsePositiveInteger(
        getEnv('MAX_CONCURRENT_SSH_OPS'),
        'MAX_CONCURRENT_SSH_OPS',
        100
      ),
    };
  } catch (error) {
    if (error instanceof ConfigValidationError) errors.push(error);
    throw error;
  }


  let features: FeatureFlags;
  try {
    features = {
      offlineSync: parseBoolean(getEnv('FEATURE_OFFLINE_SYNC'), 'FEATURE_OFFLINE_SYNC', true),
      p2pSync: parseBoolean(getEnv('FEATURE_P2P_SYNC'), 'FEATURE_P2P_SYNC', true),
      sessionRecording: parseBoolean(
        getEnv('FEATURE_SESSION_RECORDING'),
        'FEATURE_SESSION_RECORDING',
        true
      ),
      portForwarding: parseBoolean(
        getEnv('FEATURE_PORT_FORWARDING'),
        'FEATURE_PORT_FORWARDING',
        true
      ),
    };
  } catch (error) {
    if (error instanceof ConfigValidationError) errors.push(error);
    throw error;
  }


  const debug = parseBoolean(getEnv('DEBUG'), 'DEBUG', false);
  const enableProfiling = parseBoolean(getEnv('ENABLE_PROFILING'), 'ENABLE_PROFILING', false);

  if (errors.length > 0) {
    console.error('Configuration validation errors:');
    errors.forEach((error) => console.error(`  - ${error.message}`));
    throw new Error(`Configuration validation failed with ${errors.length} error(s)`);
  }

  return {
    server,
    database,
    auth,
    cors,
    rateLimit,
    logging,
    monitoring,
    gracefulShutdown,
    ssh,
    features,
    debug,
    enableProfiling,
    requestIdHeader: getEnv('REQUEST_ID_HEADER') || 'X-Request-ID',
    maxInFlightRequests: gracefulShutdown.maxInFlightRequests,
  };
}

let configInstance: Config | null = null;

export function getConfig(): Config {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}


