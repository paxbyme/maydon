# MAYDON

Players, facilities, and games in Namangan, Uzbekistan.

This repository implements the approved product plan incrementally. The MVP requires both reservations and Find Players. It is not ready for production.

- [Development](docs/development.md)
- [Product requirements and permissions](docs/prd.md)
- [Architecture](docs/architecture.md)
- [Roadmap and acceptance gates](docs/roadmap.md)
- [Decisions and unresolved launch gates](docs/decisions.md)
- [Verification status](docs/milestones/M1.md)

Applications: `apps/api` (NestJS API and worker), `apps/player` (Flutter Android/iOS/web), `apps/owner` and `apps/admin` (separate Flutter web applications). Shared Flutter packages live in `packages/`. Infrastructure configuration lives in `infra/`.
# maydon
