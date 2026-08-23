import crypto from 'node:crypto';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/server';
import { getDb } from '../db/connection.js';
import { AuditService } from './AuditService.js';

export interface WebAuthnCredential {
  id: string;
  user_id: string;
  credential_id: Buffer;
  public_key: Buffer;
  counter: number;
  transports?: string[];
  credential_type: string;
  backup_eligible: boolean;
  backup_state: boolean;
  attestation_type?: string;
  aaguid?: string;
  created_at: Date;
  last_used_at?: Date;
  name?: string;
  is_active: boolean;
}

export interface MFASettings {
  id: string;
  user_id: string;
  webauthn_enabled: boolean;
  webauthn_required: boolean;
  backup_codes?: string[];
  backup_codes_generated_at?: Date;
  last_modified_at: Date;
}

/**
 * WebAuthn/FIDO2 MFA Service — real cryptographic verification via
 * @simplewebauthn/server. Registration and authentication ceremonies are
 * verified against the stored credential public key; nothing here trusts
 * client-supplied "public key"/signature data directly.
 */
export class WebAuthnService {
  private db = getDb();
  private auditService = new AuditService();
  private readonly CHALLENGE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
  private readonly RP_ID = process.env.WEBAUTHN_RP_ID || 'localhost';
  private readonly RP_NAME = process.env.WEBAUTHN_RP_NAME || 'NovoSSH';
  private readonly ORIGIN = process.env.WEBAUTHN_ORIGIN || 'http://localhost:5173';

  /**
   * Generate registration options for a user
   */
  async generateRegistrationOptions(userId: string, userEmail: string): Promise<PublicKeyCredentialCreationOptionsJSON> {
    await this.db`
      DELETE FROM webauthn_registration_sessions WHERE user_id = ${userId} AND expires_at < NOW()
    `;

    const existing = await this.getUserCredentials(userId);

    const options = await generateRegistrationOptions({
      rpName: this.RP_NAME,
      rpID: this.RP_ID,
      userName: userEmail,
      userID: new TextEncoder().encode(userId),
      attestationType: 'none',
      excludeCredentials: existing.map((c) => ({
        id: c.credential_id.toString('base64url'),
        transports: (c.transports || []) as AuthenticatorTransportFuture[],
      })),
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
    });

    await this.db`
      INSERT INTO webauthn_registration_sessions (user_id, challenge, expires_at)
      VALUES (${userId}, ${options.challenge}, ${new Date(Date.now() + this.CHALLENGE_TIMEOUT_MS)})
    `;

    return options;
  }

  /**
   * Verify a completed registration ceremony and store the credential.
   */
  async verifyAndStoreCredential(
    userId: string,
    organizationId: string,
    response: RegistrationResponseJSON,
    name?: string,
  ): Promise<WebAuthnCredential> {
    const sessions = await this.db`
      SELECT * FROM webauthn_registration_sessions
      WHERE user_id = ${userId} AND expires_at > NOW()
      ORDER BY created_at DESC LIMIT 1
    `;
    if (sessions.length === 0) {
      throw new Error('Registration session expired or not found');
    }

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: sessions[0].challenge,
      expectedOrigin: this.ORIGIN,
      expectedRPID: this.RP_ID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new Error('Registration verification failed');
    }

    const { credential, credentialDeviceType, credentialBackedUp, aaguid, fmt } = verification.registrationInfo;

    await this.db`DELETE FROM webauthn_registration_sessions WHERE user_id = ${userId}`;

    const result = await this.db`
      INSERT INTO webauthn_credentials (
        user_id, organization_id, credential_id, public_key, counter, transports,
        attestation_type, backup_eligible, backup_state, credential_type, aaguid, name, is_active
      )
      VALUES (
        ${userId}, ${organizationId}, ${Buffer.from(credential.id, 'base64url')}, ${Buffer.from(credential.publicKey)},
        ${credential.counter}, ${credential.transports || null}, ${fmt}, ${credentialDeviceType === 'multiDevice'},
        ${credentialBackedUp}, 'public-key', ${aaguid || null}, ${name || null}, true
      )
      RETURNING *
    `;

    await this.db`
      INSERT INTO mfa_settings (user_id, webauthn_enabled)
      VALUES (${userId}, true)
      ON CONFLICT (user_id) DO UPDATE SET webauthn_enabled = true
    `;

    await this.auditService.logEvent(
      userId,
      undefined,
      userId,
      'webauthn_credential_registered',
      'webauthn_credential',
      result[0].id,
      { name, transports: credential.transports },
    );

    return result[0] as WebAuthnCredential;
  }

  /**
   * Generate authentication options. Pass userId when it's already known
   * (e.g. password step of login already succeeded) to scope
   * allowCredentials to that user's registered devices.
   */
  async generateAuthenticationOptions(userId?: string): Promise<PublicKeyCredentialRequestOptionsJSON> {
    const allowCredentials = userId
      ? (await this.getUserCredentials(userId)).map((c) => ({
          id: c.credential_id.toString('base64url'),
          transports: (c.transports || []) as AuthenticatorTransportFuture[],
        }))
      : undefined;

    const options = await generateAuthenticationOptions({
      rpID: this.RP_ID,
      userVerification: 'preferred',
      allowCredentials,
    });

    await this.db`
      INSERT INTO webauthn_authentication_sessions (user_id, challenge, expires_at)
      VALUES (${userId || null}, ${options.challenge}, ${new Date(Date.now() + this.CHALLENGE_TIMEOUT_MS)})
    `;

    return options;
  }

  /**
   * Verify a completed authentication ceremony against the stored credential
   * (real signature verification, not just a credentialId + counter check).
   */
  async verifyAuthentication(userId: string, response: AuthenticationResponseJSON): Promise<WebAuthnCredential> {
    const sessions = await this.db`
      SELECT * FROM webauthn_authentication_sessions
      WHERE user_id = ${userId} AND expires_at > NOW()
      ORDER BY created_at DESC LIMIT 1
    `;
    if (sessions.length === 0) {
      throw new Error('Authentication session expired or not found');
    }

    const credentialId = Buffer.from(response.rawId, 'base64url');
    const credentials = await this.db`
      SELECT * FROM webauthn_credentials
      WHERE credential_id = ${credentialId} AND user_id = ${userId} AND is_active = true
      LIMIT 1
    `;
    if (credentials.length === 0) {
      throw new Error('Credential not found');
    }
    const stored = credentials[0] as WebAuthnCredential;

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: sessions[0].challenge,
      expectedOrigin: this.ORIGIN,
      expectedRPID: this.RP_ID,
      credential: {
        id: stored.credential_id.toString('base64url'),
        publicKey: new Uint8Array(stored.public_key),
        counter: stored.counter,
        transports: (stored.transports || []) as AuthenticatorTransportFuture[],
      },
    });

    if (!verification.verified) {
      throw new Error('Authentication verification failed');
    }

    await this.db`DELETE FROM webauthn_authentication_sessions WHERE user_id = ${userId}`;

    const updated = await this.db`
      UPDATE webauthn_credentials
      SET counter = ${verification.authenticationInfo.newCounter}, last_used_at = NOW()
      WHERE id = ${stored.id}
      RETURNING *
    `;

    return updated[0] as WebAuthnCredential;
  }

  /**
   * Get all credentials for a user
   */
  async getUserCredentials(userId: string): Promise<WebAuthnCredential[]> {
    return this.db`
      SELECT * FROM webauthn_credentials
      WHERE user_id = ${userId} AND is_active = true
      ORDER BY last_used_at DESC NULLS LAST
    `;
  }

  /**
   * Delete a credential
   */
  async deleteCredential(credentialId: string, userId: string): Promise<void> {
    await this.db`
      UPDATE webauthn_credentials
      SET is_active = false
      WHERE id = ${credentialId} AND user_id = ${userId}
    `;

    await this.auditService.logEvent(
      userId,
      undefined,
      userId,
      'webauthn_credential_deleted',
      'webauthn_credential',
      credentialId
    );
  }

  /**
   * Rename a credential
   */
  async renameCredential(
    credentialId: string,
    userId: string,
    name: string
  ): Promise<WebAuthnCredential> {
    const result = await this.db`
      UPDATE webauthn_credentials
      SET name = ${name}
      WHERE id = ${credentialId} AND user_id = ${userId}
      RETURNING *
    `;

    return result[0] as WebAuthnCredential;
  }

  /**
   * Get MFA settings for a user
   */
  async getMFASettings(userId: string): Promise<MFASettings | null> {
    const result = await this.db`
      SELECT * FROM mfa_settings WHERE user_id = ${userId} LIMIT 1
    `;
    return (result[0] as MFASettings) || null;
  }

  /**
   * Update MFA settings
   */
  async updateMFASettings(
    userId: string,
    settings: Partial<MFASettings>
  ): Promise<MFASettings> {
    // Ensure settings exist
    await this.db`
      INSERT INTO mfa_settings (user_id)
      VALUES (${userId})
      ON CONFLICT (user_id) DO NOTHING
    `;

    // Update only specified fields
    if (settings.webauthn_enabled !== undefined) {
      await this.db`
        UPDATE mfa_settings
        SET webauthn_enabled = ${settings.webauthn_enabled}, last_modified_at = NOW()
        WHERE user_id = ${userId}
      `;
    }

    if (settings.webauthn_required !== undefined) {
      await this.db`
        UPDATE mfa_settings
        SET webauthn_required = ${settings.webauthn_required}, last_modified_at = NOW()
        WHERE user_id = ${userId}
      `;
    }

    if (settings.backup_codes !== undefined) {
      await this.db`
        UPDATE mfa_settings
        SET backup_codes = ${settings.backup_codes}, last_modified_at = NOW()
        WHERE user_id = ${userId}
      `;
    }

    // Return updated settings
    const result = await this.db`
      SELECT * FROM mfa_settings WHERE user_id = ${userId} LIMIT 1
    `;
    return result[0] as MFASettings;
  }

  /**
   * Generate backup codes
   */
  generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    return codes;
  }

  /**
   * Save backup codes
   */
  async saveBackupCodes(userId: string, codes: string[]): Promise<MFASettings> {
    const result = await this.db`
      INSERT INTO mfa_settings (user_id, backup_codes, backup_codes_generated_at)
      VALUES (${userId}, ${codes}, NOW())
      ON CONFLICT (user_id) DO UPDATE
      SET backup_codes = ${codes}, backup_codes_generated_at = NOW()
      RETURNING *
    `;

    return result[0] as MFASettings;
  }

  /**
   * Verify and consume a backup code
   */
  async verifyBackupCode(userId: string, code: string): Promise<boolean> {
    const settings = await this.getMFASettings(userId);
    if (!settings || !settings.backup_codes) {
      return false;
    }

    const index = settings.backup_codes.indexOf(code);
    if (index === -1) {
      return false;
    }

    // Remove used code
    const newCodes = settings.backup_codes.filter((_, i) => i !== index);
    await this.updateMFASettings(userId, { backup_codes: newCodes });

    return true;
  }

  /**
   * Cleanup expired sessions
   */
  async cleanupExpiredSessions(): Promise<void> {
    await this.db`
      DELETE FROM webauthn_registration_sessions WHERE expires_at < NOW()
    `;

    await this.db`
      DELETE FROM webauthn_authentication_sessions WHERE expires_at < NOW()
    `;
  }
}
