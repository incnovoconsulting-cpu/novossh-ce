import express, { Request, Response } from 'express';
import { SamlService } from '../services/SamlService.js';
import { authMiddleware } from '../middleware/auth.js';
import * as xmlCrypto from 'xml-crypto';
import { DOMParser } from '@xmldom/xmldom';

const router = express.Router();
const samlService = new SamlService();

/**
 * Verify the XML digital signature of a SAML response using the IdP certificate.
 * Returns the signed assertion element or null if verification fails.
 */
function verifySamlSignature(
  decodedXml: string,
  idpCertificate: string
): { assertionXml: string; issuer: string; attributes: Record<string, string[]>; nameId: string; notOnOrAfter: Date | null; inResponseTo: string | null } | null {
  const doc = new (DOMParser as any)({}).parseFromString(decodedXml);

  // Find the Assertion element
  const assertions = doc.getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:assertion', 'Assertion');
  if (assertions.length === 0) return null;
  const assertion = assertions.item(0);
  if (!assertion) return null;

  // Find the Signature element inside the Assertion
  const signatures = assertion.getElementsByTagNameNS('http://www.w3.org/2000/09/xmldsig#', 'Signature');
  if (signatures.length === 0) return null;

  // Verify the signature using the IdP certificate
  const certPem = `-----BEGIN CERTIFICATE-----\n${idpCertificate}\n-----END CERTIFICATE-----`;
  const sig = new (xmlCrypto.SignedXml as any)(undefined, { publicCert: certPem });
  sig.loadSignature(signatures.item(0) as any);

  let isValid = false;
  sig.checkSignature(decodedXml, (err: any) => {
    isValid = !err;
  });
  if (!isValid) return null;

  // Extract issuer
  const issuerNodes = assertion.getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:assertion', 'Issuer');
  const issuer = issuerNodes.length > 0 ? issuerNodes.item(0)?.textContent || '' : '';

  // Extract NameID
  const nameIdNodes = assertion.getElementsByTagNameNS('urn:oasis:names:tc:SAML:2.0:assertion', 'NameID');
  const nameId = nameIdNodes.length > 0 ? nameIdNodes.item(0)?.textContent || '' : '';

  // Extract SubjectConfirmationData for InResponseTo and NotOnOrAfter
  let notOnOrAfter: Date | null = null;
  let inResponseTo: string | null = null;
  const subjectConfirmationData = assertion.getElementsByTagNameNS(
    'urn:oasis:names:tc:SAML:2.0:assertion', 'SubjectConfirmationData'
  );
  if (subjectConfirmationData.length > 0) {
    const scd = subjectConfirmationData.item(0);
    const notAfter = scd?.getAttribute('NotOnOrAfter');
    if (notAfter) notOnOrAfter = new Date(notAfter);
    inResponseTo = scd?.getAttribute('InResponseTo') ?? null;
  }

  // Also check Conditions element for NotOnOrAfter
  const conditions = assertion.getElementsByTagNameNS(
    'urn:oasis:names:tc:SAML:2.0:assertion', 'Conditions'
  );
  if (conditions.length > 0) {
    const cond = conditions.item(0);
    const notAfter = cond?.getAttribute('NotOnOrAfter');
    if (notAfter) {
      const condDate = new Date(notAfter);
      if (!notOnOrAfter || condDate < notOnOrAfter) {
        notOnOrAfter = condDate;
      }
    }
  }

  // Extract attributes
  const attributes: Record<string, string[]> = {};
  const attrStatements = assertion.getElementsByTagNameNS(
    'urn:oasis:names:tc:SAML:2.0:assertion', 'AttributeStatement'
  );
  if (attrStatements.length > 0) {
    const attrNodes = attrStatements.item(0)!.getElementsByTagNameNS(
      'urn:oasis:names:tc:SAML:2.0:assertion', 'Attribute'
    );
    for (let i = 0; i < attrNodes.length; i++) {
      const attr = attrNodes.item(i);
      const name = attr?.getAttribute('Name') || '';
      const values = attr?.getElementsByTagNameNS(
        'urn:oasis:names:tc:SAML:2.0:assertion', 'AttributeValue'
      );
      if (name && values && values.length > 0) {
        attributes[name] = [];
        for (let j = 0; j < values.length; j++) {
          const val = values.item(j)?.textContent || '';
          attributes[name].push(val);
        }
      }
    }
  }

  return {
    assertionXml: assertion.toString(),
    issuer,
    nameId,
    attributes,
    notOnOrAfter,
    inResponseTo,
  };
}

/**
 * GET /api/saml/login
 * Initiate SAML SSO login flow
 */
router.get('/login', async (req: Request, res: Response) => {
  try {
    const { organizationId } = req.query;

    if (!organizationId) {
      res.status(400).json({ error: 'organizationId is required' });
      return;
    }

    const config = await samlService.getActiveConfiguration(organizationId as string);
    if (!config) {
      res.status(404).json({ error: 'SAML configuration not found' });
      return;
    }

    const { xml, requestId } = samlService.generateAuthnRequest(config);

    res.json({
      samlRequest: Buffer.from(xml).toString('base64'),
      redirectUrl: config.sso_url,
      requestId,
    });
  } catch (error) {
    console.error('[saml] Login failed:', error);
    res.status(500).json({ error: 'SAML login initiation failed' });
  }
});

/**
 * POST /api/saml/acs
 * Assertion Consumer Service endpoint (SAML response callback)
 */
router.post('/acs', async (req: Request, res: Response) => {
  try {
    const { SAMLResponse, organizationId } = req.body;

    if (!SAMLResponse || !organizationId) {
      res.status(400).json({ error: 'SAMLResponse and organizationId are required' });
      return;
    }

    const config = await samlService.getActiveConfiguration(organizationId);
    if (!config) {
      res.status(404).json({ error: 'SAML configuration not found' });
      return;
    }

    // Decode the base64 SAML response
    const decodedResponse = Buffer.from(SAMLResponse, 'base64').toString('utf-8');

    // Verify XML signature using the IdP certificate
    const verification = verifySamlSignature(decodedResponse, config.certificate);
    if (!verification) {
      res.status(403).json({ error: 'SAML signature verification failed' });
      return;
    }

    // Verify issuer matches expected IdP entity ID
    if (verification.issuer !== config.entity_id) {
      res.status(403).json({ error: 'SAML issuer mismatch' });
      return;
    }

    // Check assertion expiry
    if (verification.notOnOrAfter && verification.notOnOrAfter < new Date()) {
      res.status(403).json({ error: 'SAML assertion has expired' });
      return;
    }

    const samlResponse = {
      issuer: verification.issuer,
      nameId: verification.nameId,
      attributes: verification.attributes,
    };

    // Provision or find user
    const mapping = await samlService.provisionUser(
      organizationId,
      config.id,
      samlResponse,
      true
    );

    res.json({
      success: true,
      userId: mapping.user_id,
      email: mapping.saml_email,
      isNewUser: !mapping.last_login_at,
    });
  } catch (error) {
    console.error('[saml] ACS failed:', error);
    res.status(500).json({ error: 'SAML assertion processing failed' });
  }
});

/**
 * GET /api/saml/metadata
 * Get SP metadata for IdP configuration
 */
router.get('/metadata', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const config = await samlService.getActiveConfiguration(req.user.id);
    if (!config) {
      res.status(404).json({ error: 'SAML configuration not found' });
      return;
    }

    const spEntityId = `urn:novossh:${req.user.id}`;
    const metadata = samlService.generateMetadata(config, spEntityId);

    res.type('text/xml').send(metadata);
  } catch (error) {
    console.error('[saml] Metadata failed:', error);
    res.status(500).json({ error: 'Failed to generate metadata' });
  }
});

/**
 * POST /api/saml/config
 * Create or update SAML configuration (admin)
 */
router.post('/config', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { entity_id, sso_url, slo_url, certificate, name_id_format, assertion_consumer_service_url } =
      req.body;

    if (!entity_id || !sso_url || !certificate || !assertion_consumer_service_url) {
      res.status(400).json({
        error: 'Missing required fields: entity_id, sso_url, certificate, assertion_consumer_service_url',
      });
      return;
    }

    const config = await samlService.createConfiguration(req.user.id, {
      organization_id: req.user.id,
      entity_id,
      sso_url,
      slo_url,
      certificate,
      name_id_format: name_id_format || 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      assertion_consumer_service_url,
      is_active: true,
    });

    res.status(201).json({
      id: config.id,
      entity_id: config.entity_id,
      sso_url: config.sso_url,
      is_active: config.is_active,
    });
  } catch (error) {
    console.error('[saml] Config creation failed:', error);
    res.status(500).json({ error: 'SAML configuration creation failed' });
  }
});

/**
 * GET /api/saml/config
 * Get current SAML configuration (admin)
 */
router.get('/config', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const config = await samlService.getActiveConfiguration(req.user.id);
    if (!config) {
      res.status(404).json({ error: 'SAML configuration not found' });
      return;
    }

    res.json({
      id: config.id,
      entity_id: config.entity_id,
      sso_url: config.sso_url,
      name_id_format: config.name_id_format,
      is_active: config.is_active,
    });
  } catch (error) {
    console.error('[saml] Config fetch failed:', error);
    res.status(500).json({ error: 'Failed to fetch SAML configuration' });
  }
});

/**
 * POST /api/saml/logout
 * SAML logout endpoint
 */
router.post('/logout', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { organizationId } = req.body;
    const config = await samlService.getActiveConfiguration(organizationId || req.user.id);

    if (!config) {
      res.json({ message: 'Logged out successfully' });
      return;
    }

    const { xml, requestId } = samlService.generateLogoutRequest(config);

    res.json({
      samlLogoutRequest: Buffer.from(xml).toString('base64'),
      redirectUrl: config.slo_url || config.sso_url,
      requestId,
    });
  } catch (error) {
    console.error('[saml] Logout failed:', error);
    res.status(500).json({ error: 'SAML logout failed' });
  }
});

export { router as samlRouter };
