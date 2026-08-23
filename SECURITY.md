# Security Policy

## Supported Versions

This is a young open source project without long-term-support branches yet — security fixes are applied to the `main` branch and released promptly. If you're running an older commit, please update before reporting an issue you haven't reproduced on `main`.

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Please use [GitHub Security Advisories](../../security/advisories/new) to report privately, or email **security@novoconsultinginc.org** with:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fix (optional)

You will receive an acknowledgement within **48 hours** and a resolution timeline within **7 days**.

We follow responsible disclosure: please give us 90 days to patch before public disclosure. We will credit researchers who report valid vulnerabilities (unless you prefer to remain anonymous).

This applies to the self-hosted codebase in this repository. If you've found an issue specific to the hosted novossh.com service (account takeover, billing, infrastructure), please report it the same way — it will be routed appropriately.

## Scope

In scope:
- Authentication and session management
- JWT handling and token validation
- Credential storage and encryption (vault)
- WebSocket relay authentication
- API authorization (RBAC enforcement)
- SQL injection, XSS, CSRF

Out of scope:
- Attacks requiring physical access to a self-hosted server
- Social engineering
- Denial of service
- Issues in third-party dependencies already publicly known (please report upstream instead)
