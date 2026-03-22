# Security Policy

VK Mini App **«Кто платит»** (`kto-platit`): client (VK Mini App) + serverless API (Vercel), Upstash Redis.

## Supported Versions

Tell maintainers and users which release lines receive security fixes. Currently only the **latest production deployment** (typically from `main`) is actively maintained.

| Version  | Supported          |
| -------- | ------------------ |
| 1.0.x    | :white_check_mark: |
| &lt; 1.0 | :x:                |

When **2.x** is released, this table will be updated; older major lines may move to unsupported.

## Reporting a Vulnerability

Please **do not** open a public issue with exploit details before a fix is available (responsible disclosure).

### How to report

1. **GitHub:** use [Security advisories](https://docs.github.com/en/code-security/security-advisories/private-vulnerability-reporting) for this repository (private report to maintainers), or contact the repository owner as described in the profile / README.
2. **Elsewhere:** if GitHub is not an option, use a dedicated security contact email (replace this line with e.g. `security@fts77.ru`).

### What to include

- Short description and **steps to reproduce** (or a minimal safe PoC).
- Affected area: client, `/api/*` routes, VK launch-params signing, Redis, etc.
- Impact (data leak, auth bypass, DoS, …).
- Version / commit or deploy date, if known.

### What to expect

- **First reply:** within a reasonable time (target **7 business days**) — acknowledgement and whether more detail is needed.
- **Outcome:** we will say if the report is accepted, whether a fix is planned, and rough timeline (depends on severity and effort).
- **Declined:** short explanation (not reproducible, not a vulnerability, out of scope, etc.).
- **After fix:** reporter will be notified when possible; critical issues are prioritized for release.

### Scope

In scope: this codebase, deployment configuration, and secrets under project control. **VK platform** vulnerabilities should be reported to **VK**’s security / support channels, not only to this app’s maintainers.

---

Template aligned with GitHub guidance: [Adding a security policy](https://docs.github.com/en/code-security/getting-started/adding-a-security-policy-to-your-repository).
