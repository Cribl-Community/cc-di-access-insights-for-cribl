# Access Insights for Cribl

**Who can do what across your Cribl organization, and why.** A read-only Cribl
App that puts Members, Teams, Roles, API Credentials, and Worker Group /
resource access in one place, resolved the same way for every account.

## The problem

In Cribl, a person's access comes from several places at once:

- Roles assigned directly.
- Roles inherited from each Team they belong to.
- Workspace roles.
- Grants on individual Worker Groups, Fleets, and resources.
- Admin roles that pass access down the hierarchy.
- For SSO users, identity-provider group mappings.

Each of these lives on its own screen. Answering *"what can this person reach,
and why?"* means visiting several screens and working out the inheritance by
hand. Comparing two people, or finding everyone with a given level of access,
is harder still.

## What it does

| Feature | What you get |
|---|---|
| **Dashboard** | User, Team, and admin counts; access per product by level; findings (disabled accounts still holding access, users in no Team, empty Teams); every user ranked by privilege |
| **Directory** | Any user, Team, or API key: product levels, Teams, every role and **where it comes from** (Direct / via Team / Workspace / inherited), and Worker Group and resource grants. An optional graph traces how each piece of access is granted |
| **Access Check** | Two users side by side: only-A, shared, only-B, and where levels differ |
| **Query** | Find accounts two ways: a **field builder** (no syntax) or **JavaScript expressions** (e.g. `hasTeam('Platform') && atLeast('stream','editor')`) with autocomplete. Both produce a visible expression; **CSV export** |
| **Worker Group lookup** | The reverse view: everyone who can reach a group, and how |
| **SSO visibility** | Sign-in method per account; Teams mapped to identity-provider groups |

## Works alongside Cribl Identity Checker

Cribl Identity Checker and Access Insights look at the same access from two
angles, so they fit together well.

- **Identity Checker** is for **any user checking their own access**. It shows
  your profile, the roles granting you access (with policy counts), your Teams,
  and your effective authorization policy: each API object you can act on and
  the actions allowed. It answers *"what can I do?"*
- **Access Insights** is for **admins and reviewers looking across the
  organization**. It answers *"who can do what, and why?"*

| | Identity Checker | Access Insights |
|---|---|---|
| **Built for** | Every user, about themselves | Admins and reviewers, about everyone |
| **Shows best** | Your exact API-level permissions (object / action) | Where each person's access comes from (Direct, a Team, Workspace, or an inherited admin role), down to Worker Groups and resources |
| **Typical questions** | "Am I allowed to do this?" | "Why does this person have this?" · "How do these two people differ?" · "Who can reach this Worker Group?" · "Who are all our admins?" |

**Using them together.** A typical *"I can't do X"* request:

1. The user checks the object in Identity Checker to confirm what they can and
   can't do.
2. An admin opens that user in Access Insights → Directory to see which Team or
   role grants the access, or that nothing does.
3. The admin compares the user with a colleague who has the access, in Access
   Check. The *Only colleague* lane shows the Team or role to add in Cribl.

**Who should get which.** When an admin shares a Cribl App, its declared read
permissions are granted to that person for requests made through the app.
Anyone Access Insights is shared with can therefore see everyone's access, so
share it with admins and reviewers. Identity Checker is the right view for
everyone else.

## Permissions and data

- **Read-only.** It only sends `GET` requests to the Cribl API paths declared
  in [`config/policies.yml`](config/policies.yml), which admins see at install:
  - `/system/teams`, `/system/roles`, `/system/credentials`;
  - per-product member lists and their ACLs;
  - Worker Group lists and their ACLs.
- **The only write** is the Dashboard card layout, saved to the app's own KV
  store.
- **No data leaves Cribl**, and no external domains are declared
  (`config/proxies.yml`).

## Known limitations

- **Snapshot, not live.** Data refreshes on load and when you click Refresh.
- **No login history.** Cribl's API exposes no last-login time and keeps no
  history of access changes.
- **Partial member list.** Cribl.Cloud has no "list all members" API, so the
  roster is merged from each product's member list. Members with no product
  access may not appear.
- **Levels come from role ids.** Product levels are derived from role ids
  (e.g. `stream_editor` → Editor). Custom roles that don't follow the pattern
  are listed by name without a level.
- **Mixed grants can show the lower level.** When one group is granted Read by
  one source and Editor by another, the Details tables may show Read. The graph
  shows each source correctly.

## Install

1. `npm install`
2. `npm run package` builds the app and writes `build/rbac-insights-<version>.tgz`.
   Each run increments the patch version; see `AGENTS.md` for `--minor`,
   `--major`, and `--version`.
3. Install the `.tgz` in a Cribl.Cloud workspace from Cribl's Apps page, as
   described in Cribl's Apps documentation. At install, Cribl lists the API
   paths the app reads (`config/policies.yml`). No credentials, keys, or
   external services are needed.
4. Open **Access Insights for Cribl** from the workspace. A Workspace
   Administrator sees the full picture. Share the app with admins and reviewers
   only (see above).

## Development

```bash
npm install
npm run dev       # Vite dev server at http://localhost:5173
npm run lint      # oxlint
npm run build     # typecheck + production build
```

API data is only available when running inside Cribl (`window.CRIBL_API_URL`).
See [`AGENTS.md`](AGENTS.md) for the Cribl App Platform guide that ships with
the app template.

## Build disclosure

Built entirely during the hackathon build window (from 2026-09-14), on the
Cribl App Platform template. No earlier version of this app existed.

## AI tool disclosure

This app was built with help from **Claude Code** (Anthropic), an AI coding
assistant. It was used to write and refactor code, CSS, and documentation, and
to test the UI in a headless browser against fictional sample data. The author
directed the work, reviewed the changes, and tested the app in a Cribl.Cloud
workspace.

**The app itself has no AI features.** It calls no AI or LLM services, and the
query language runs entirely in the browser.

## Data in this repository

- **The Help screenshots** (`src/assets/help/`) come from a **fictional
  organization**. Every name and address uses `example.com`.
- **No customer data, personal data, hostnames, or credentials.** The repo
  contains none. The app reads live data from the workspace it's installed in
  and stores none of it, apart from the Dashboard card layout in the KV store.
  No secrets are stored in KV.

## Credits and licenses

Licensed under the **Apache License 2.0** (see [`LICENSE`](LICENSE)).

Built by **[Discovered Intelligence](https://discoveredintelligence.com)**. The
Discovered Intelligence name and "D" mark
(`src/assets/brand/discovered-intelligence-mark.png`, taken from the company's
official logo) are trademarks of Discovered Intelligence Inc. The Apache-2.0
license doesn't cover them. Replace the mark if you fork or redistribute the
app.

Built on the **Cribl App Platform template**, which provides the Vite setup,
packaging scripts (`scripts/`), and `AGENTS.md`.

| Component | Used for | License |
|---|---|---|
| [Capra](https://capra.cribl.io) (`@capra/core`, `icons`, `theme`, `dx-tokens-postcss-plugin`) | Cribl's design system: components, icons, tokens | Cribl Developer Agreement (Cribl-provided; for use on the Cribl platform) |
| [React](https://react.dev) 19 and React DOM | UI | MIT |
| [React Router](https://reactrouter.com) 7 | Routing | MIT |
| [React Flow](https://reactflow.dev) (`@xyflow/react`) 12 | Access graph and access map | MIT |
| [d3-hierarchy](https://github.com/d3/d3-hierarchy) 3 | Tree layout for the graph | ISC |
| [CodeMirror](https://codemirror.net) 6 (`@codemirror/*`, `@lezer/highlight`) | Query expression editor | MIT |
| [Vite](https://vite.dev) 8, [TypeScript](https://www.typescriptlang.org) 6 | Build and type checking (dev) | MIT, Apache-2.0 |
| [oxlint](https://oxc.rs) | Linting (dev) | MIT |
| [Playwright](https://playwright.dev) | Headless-browser checks during development (dev) | Apache-2.0 |
| [Claude Code](https://www.anthropic.com/claude-code) | AI coding assistant (see above) | Tool only; no code library included |
