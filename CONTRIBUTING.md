# Contributing to NovoSSH Community Edition

Thanks for considering a contribution. This project is licensed under [AGPL-3.0](LICENSE); by submitting a pull request you agree your contribution is offered under that same license and that you have the right to submit it. There is no separate contributor license agreement or copyright assignment — you retain copyright on your contribution, licensed to the project (and everyone else) under AGPL-3.0.

## Ways to contribute

- **Bug reports** — [open an issue](../../issues/new?template=bug_report.md) with steps to reproduce.
- **Feature requests** — [open an issue](../../issues/new?template=feature_request.md) describing the problem it solves.
- **Code** — bug fixes, new features, refactors. For anything larger than a small fix, open an issue or discussion first so we can agree on direction before you invest the time.
- **Docs** — fixes and improvements to anything under `docs/` or the top-level `.md` files are always welcome.

## Development setup

```bash
git clone https://github.com/incnovoconsulting-cpu/novossh-ce.git
cd novossh-ce
npm install
cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET at minimum
npm run dev             # web (Vite) + API, concurrently
```

Useful commands while developing:

| Command | What it does |
|---|---|
| `npm run dev` | Start web + API dev servers |
| `npm test` | Run the unit/integration test suite (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run typecheck` | Type-check both the frontend and `server/` |
| `npm run build` | Production build |
| `npm run tauri:dev` | Desktop app dev build (requires Rust + Tauri prerequisites) |

Desktop (Tauri) work additionally needs a Rust toolchain; Android needs a JDK + Android SDK; iOS needs Xcode. You don't need any of these to work on the web app or backend.

## Before opening a pull request

1. **Keep it focused.** One logical change per PR — easier to review, easier to revert if something's wrong.
2. **Tests.** Add or update tests for behavior you change. `npm test` must pass.
3. **Types.** `npm run typecheck` must pass.
4. **No secrets.** Never commit `.env` files, real credentials, API keys, or infrastructure details (IPs, hostnames, account IDs). Use the `.env.example` files as the template for what a new variable should look like.
5. **Describe the change.** Fill in the PR template — what changed and why, not just what.

We don't require a specific commit message format, but clear, descriptive commit messages are appreciated.

## Reporting security issues

Do not open a public issue for a security vulnerability. See [SECURITY.md](SECURITY.md) for how to report it privately.

## Code of Conduct

This project follows the [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you're expected to uphold it.

## Questions

Open a [discussion](../../discussions) or an issue if you're not sure whether something is a bug, a good first contribution, or worth a bigger design conversation before you start.
