# Agent instructions

Project-level preferences for AI agents and skills. These take precedence over a skill's built-in defaults.

## Planning doc locations

`docs/plans/` is the single canonical home for planning docs, named for its purpose (not for any tool). All agents and skills, including Superpowers, write planning artifacts here. There is no tool-named folder.

- Implementation plans: `docs/plans/YYYY-MM-DD-<feature-name>.md`
  (overrides the `writing-plans` skill default of `docs/superpowers/plans/`).
- Brainstorming / design specs: `docs/plans/specs/YYYY-MM-DD-<topic>-design.md`
  (overrides the `brainstorming` skill default of `docs/superpowers/specs/`).

Hand-authored and tool-generated plans live side by side at the top level of `docs/plans/`; only design specs are nested under `docs/plans/specs/`. Do NOT create a `docs/superpowers/` folder.

The runtime `.superpowers/` folder at the repo root is a transient working directory for the brainstorming companion and stays gitignored; it is unrelated to these committed output locations.

## House style

- No em dashes in any file (see `.cursor/rules/no-em-dashes.mdc`).
