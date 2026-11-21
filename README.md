# email-manager

A lightweight, scheduled email manager: rules and spam checks first, AI only where needed.
It filters spam and repetitive mail, drafts or sends replies where safe, and turns mail that needs attention into tasks.

Status: design phase. See [docs/design.md](docs/design.md).

## Control panel mock

`web/` is a clickable React + TypeScript mock of the control panel with mock data (no backend yet).
The UX thinking behind it is in [docs/ux.md](docs/ux.md).

```sh
cd web
npm install
npm run dev     # http://localhost:5173
npm test
```
