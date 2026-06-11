# FitFlow Agent Rules

## Living Project Documentation

`PROJECT.md` is the source of truth for FitFlow's product and implementation history.

After every meaningful change, update `PROJECT.md` in the same task. A meaningful change includes:

- Adding, removing, or changing user-facing functionality.
- Changing navigation, visual design, accessibility, or interaction behavior.
- Changing domain types, calculations, local persistence, authentication, cloud sync, or database schema.
- Adding tests, deployment configuration, developer workflows, or important dependencies.
- Discovering a material risk, limitation, bug, or architectural decision.

Keep these sections current:

1. Product Summary
2. User Experience and Design System
3. Functional Areas
4. Architecture and Data Flow
5. Database and Security
6. Verification and Deployment
7. Decision Log
8. Implementation Log
9. Known Constraints and Next Work

Documentation rules:

- Record what changed, why it changed, and how it works.
- Add dated implementation-log entries for meaningful work.
- Keep decision-log entries concise and explain rejected alternatives when relevant.
- Do not claim tests, builds, deployment, or integrations succeeded unless verified.
- Never place secrets, tokens, credentials, or personal user data in `PROJECT.md`.
