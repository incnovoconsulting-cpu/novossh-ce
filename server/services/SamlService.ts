import crypto from 'node:crypto';
import { getDb } from '../db/connection.js';
import { AuditService } from './AuditService.js';

export interface SamlConfiguration {
  id: string;
  organization_id: string;
  entity_id: string;
  sso_url: string;
  slo_url?: string;
  certificate: string;
  metadata_url?: string;
  name_id_format: string;
  assertion_consumer_service_url: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface SamlUserMapping {
  id: string;
  organization_id: string;
  saml_configuration_id: string;
  saml_name_id: string;
  user_id: string;
  saml_email?: string;
  saml_attributes?: Record<string, unknown>;
  last_login_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface SamlResponse {
  issuer: string;
  nameId: string;
  sessionIndex?: string;
  attributes: Record<string, string[]>;
  notOnOrAfter?: Date;
}

/**
 * SAML 2.0 Service Provider Authentication
 * Handles SAML configuration, user provisioning, and SSO flows
 */
export class SamlService {
  private db = getDb();
  private auditService = new AuditService();

  /**
   * Create a new SAML configuration for an organization
   */
  async createConfiguration(
    organizationId: string,
    config: Omit<SamlConfiguration, 'id' | 'created_at' | 'updated_at'>
  ): Promise<SamlConfiguration> {
    const result = await this.db`
      INSERT INTO saml_configurations (
        organization_id, entity_id, sso_url, slo_url, certificate,
        metadata_url, name_id_format, assertion_consumer_service_url, is_active
      )
      VALUES (
        ${organizationId}, ${config.entity_id}, ${config.sso_url}, ${config.slo_url || null},
        ${config.certificate}, ${config.metadata_url || null}, ${config.name_id_format},
        ${config.assertion_consumer_service_url}, ${config.is_active}
      )
      RETURNING *
    `;

    await this.auditService.logEvent(
      organizationId,
      undefined,
      organizationId,
      'saml_config_created',
      'saml_configuration',
      result[0].id,
      { entity_id: config.entity_id, sso_url: config.sso_url }
    );

    return result[0] as SamlConfiguration;
  }

  /**
   * Get SAML configuration by ID
   */
  async getConfiguration(configurationId: string): Promise<SamlConfiguration | null> {
    const result = await this.db`
      SELECT * FROM saml_configurations WHERE id = ${configurationId} LIMIT 1
    `;
    return (result[0] as SamlConfiguration) || null;
  }

  /**
   * Get active SAML configuration for organization
   */
  async getActiveConfiguration(organizationId: string): Promise<SamlConfiguration | null> {
    const result = await this.db`
      SELECT * FROM saml_configurations
      WHERE organization_id = ${organizationId} AND is_active = TRUE
      LIMIT 1
    `;
    return (result[0] as SamlConfiguration) || null;
  }

  /**
   * Update SAML configuration
   */
  async updateConfiguration(
    configurationId: string,
    updates: Partial<SamlConfiguration>
  ): Promise<SamlConfiguration> {
    const setClauses: string[] = [];
    const values: unknown[] = [];

    if (updates.entity_id !== undefined) {
      setClauses.push(`entity_id = $${setClauses.length + 1}`);
      values.push(updates.entity_id);
    }
    if (updates.sso_url !== undefined) {
      setClauses.push(`sso_url = $${setClauses.length + 1}`);
      values.push(updates.sso_url);
    }
    if (updates.certificate !== undefined) {
      setClauses.push(`certificate = $${setClauses.length + 1}`);
      values.push(updates.certificate);
    }
    if (updates.is_active !== undefined) {
      setClauses.push(`is_active = $${setClauses.length + 1}`);
      values.push(updates.is_active);
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(configurationId);

    const result = await this.db`
      UPDATE saml_configurations
      SET ${setClauses.join(', ')}
      WHERE id = ${configurationId}
      RETURNING *
    `;

    return result[0] as SamlConfiguration;
  }

  /**
   * Provision or update a user via SAML assertion
   */
  async provisionUser(
    organizationId: string,
    samlConfigurationId: string,
    samlResponse: SamlResponse,
    autoCreate: boolean = false
  ): Promise<SamlUserMapping> {
    const samlNameId = samlResponse.nameId;
    const samlEmail = samlResponse.attributes.email?.[0];

    // Check if mapping exists
    let mapping = await this.db`
      SELECT * FROM saml_user_mappings
      WHERE saml_configuration_id = ${samlConfigurationId}
      AND saml_name_id = ${samlNameId}
      LIMIT 1
    `;

    if (mapping.length > 0) {
      // Update last login
      const updated = await this.db`
        UPDATE saml_user_mappings
        SET last_login_at = NOW(), saml_attributes = ${JSON.stringify(samlResponse.attributes)}
        WHERE id = ${mapping[0].id}
        RETURNING *
      `;
      return updated[0] as SamlUserMapping;
    }

    // Create new mapping or find user by email
    let userId: string | null = null;

    if (samlEmail) {
      const users = await this.db`
        SELECT id FROM users WHERE email = ${samlEmail} LIMIT 1
      `;
      if (users.length > 0) {
        userId = users[0].id;
      }
    }

    if (!userId && autoCreate && samlEmail) {
      // Auto-create user if SAML email provided
      const newUsers = await this.db`
        INSERT INTO users (email, password_hash, email_verified)
        VALUES (${samlEmail}, ${crypto.randomBytes(32).toString('hex')}, TRUE)
        RETURNING id
      `;
      userId = newUsers[0].id;
    }

    if (!userId) {
      throw new Error('No user found and auto-create disabled');
    }

    // Create mapping
    const newMapping = await this.db`
      INSERT INTO saml_user_mappings (
        organization_id, saml_configuration_id, saml_name_id, user_id,
        saml_email, saml_attributes, last_login_at
      )
      VALUES (
        ${organizationId}, ${samlConfigurationId}, ${samlNameId}, ${userId},
        ${samlEmail || null}, ${JSON.stringify(samlResponse.attributes)}, NOW()
      )
      RETURNING *
    `;

    await this.auditService.logEvent(
      organizationId,
      undefined,
      userId,
      'saml_login',
      'saml_user_mapping',
      newMapping[0].id,
      { saml_name_id: samlNameId, saml_email: samlEmail }
    );

    return newMapping[0] as SamlUserMapping;
  }

  /**
   * Get SAML user mapping
   */
  async getUserMapping(mappingId: string): Promise<SamlUserMapping | null> {
    const result = await this.db`
      SELECT * FROM saml_user_mappings WHERE id = ${mappingId} LIMIT 1
    `;
    return (result[0] as SamlUserMapping) || null;
  }

  /**
   * Get SAML mapping by SAML NameID
   */
  async getMappingByNameId(
    samlConfigurationId: string,
    samlNameId: string
  ): Promise<SamlUserMapping | null> {
    const result = await this.db`
      SELECT * FROM saml_user_mappings
      WHERE saml_configuration_id = ${samlConfigurationId}
      AND saml_name_id = ${samlNameId}
      LIMIT 1
    `;
    return (result[0] as SamlUserMapping) || null;
  }

  /**
   * Generate SAML AuthnRequest XML
   */
  generateAuthnRequest(configuration: SamlConfiguration): { xml: string; requestId: string } {
    const requestId = `_${crypto.randomBytes(16).toString('hex')}`;
    const issueInstant = new Date().toISOString();

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<samlp:AuthnRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
  xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
  ID="${requestId}"
  Version="2.0"
  IssueInstant="${issueInstant}"
  Destination="${configuration.sso_url}"
  AssertionConsumerServiceURL="${configuration.assertion_consumer_service_url}"
  ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">
  <saml:Issuer>${configuration.entity_id}</saml:Issuer>
  <samlp:NameIDPolicy Format="${configuration.name_id_format}" AllowCreate="true"/>
</samlp:AuthnRequest>`;

    return { xml, requestId };
  }

  /**
   * Generate SAML LogoutRequest XML
   */
  generateLogoutRequest(
    configuration: SamlConfiguration,
    sessionIndex?: string
  ): { xml: string; requestId: string } {
    const requestId = `_${crypto.randomBytes(16).toString('hex')}`;
    const issueInstant = new Date().toISOString();

    let sessionIndexXml = '';
    if (sessionIndex) {
      sessionIndexXml = `<samlp:SessionIndex>${sessionIndex}</samlp:SessionIndex>`;
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<samlp:LogoutRequest xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
  xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
  ID="${requestId}"
  Version="2.0"
  IssueInstant="${issueInstant}"
  Destination="${configuration.slo_url || configuration.sso_url}">
  <saml:Issuer>${configuration.entity_id}</saml:Issuer>
  ${sessionIndexXml}
</samlp:LogoutRequest>`;

    return { xml, requestId };
  }

  /**
   * Generate SAML metadata
   */
  generateMetadata(configuration: SamlConfiguration, spEntityId: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${spEntityId}">
  <SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true"
    protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <NameIDFormat>${configuration.name_id_format}</NameIDFormat>
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${configuration.assertion_consumer_service_url}"
      index="0"
      isDefault="true"/>
  </SPSSODescriptor>
  <IDPSSODescriptor WantAuthnRequestsSigned="false"
    protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <KeyDescriptor use="signing">
      <KeyInfo xmlns="http://www.w3.org/2000/09/xmldsig#">
        <X509Data>
          <X509Certificate>${configuration.certificate}</X509Certificate>
        </X509Data>
      </KeyInfo>
    </KeyDescriptor>
    <SingleSignOnService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
      Location="${configuration.sso_url}"/>
    ${configuration.slo_url ? `<SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="${configuration.slo_url}"/>` : ''}
  </IDPSSODescriptor>
</EntityDescriptor>`;
  }

  /**
   * Delete SAML configuration
   */
  async deleteConfiguration(configurationId: string): Promise<void> {
    await this.db`
      DELETE FROM saml_configurations WHERE id = ${configurationId}
    `;
  }
}
