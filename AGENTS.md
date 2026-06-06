# Agent Instructions for radegast-console-ui (Frontend)

> **Note**: This document contains frontend-specific instructions. For backend-specific instructions and full project context, see the main [AGENTS.md](../AGENTS.md) in the project root.

## Repository Layout

- Frontend code is in `web/` (current directory).
- Backend code is in `app/` (see main [AGENTS.md](../AGENTS.md), can be cloned from https://github.com/radegast-edr/radegast-console-backend where the `web/` - this repo - is a submodule).
- Treat this as a standalone SvelteKit frontend project.

## Code Style

- Cover all new features with new tests so that the test coverage does not decrease.
- Follow Svelte best practices and TypeScript conventions.

## API Type Generation

The TypeScript types in `src/lib/openapi.d.ts` are auto-generated from the backend's OpenAPI schema. Whenever the backend API changes (endpoints or Pydantic models are added/changed/removed), regenerate the types:

1. Regenerate the types:

```bash
cd ..
uv run gen-openapi.py
cd web
npm run generate
```

2. Rebuild the frontend to verify no type errors were introduced:

```bash
npm run build
```

Do **not** edit `openapi.d.ts` by hand — it will be overwritten on the next run.

## Required Post-Task Validation

After completing each task, always run all validations in this order:

1. Rebuild frontend and fix all build/Svelte/a11y warnings:

```bash
npm run build
```

Make sure the build output contains **no compile, Svelte, or accessibility warnings**. Any warnings must be fixed before ending the task.

2. Run all frontend tests:

```bash
npm run test
```

## UI Styling & Theme Guidelines

- **Theme Compatibility**: Do not hardcode light or dark background/text classes (e.g., `bg-light`, `text-dark`) on dynamic/interactive components. Use theme-aware Bootstrap classes instead (e.g., `bg-body-secondary`, `text-body`).
- **Global Modal Component**: Always use the predefined global `Modal` component (`import Modal from '$lib/components/Modal.svelte'`) for rendering dialog popups. Do not write custom inline modal layouts, overlay backdrops, or manual positioning.
- **Interactive Component State**: Do not rely on native Bootstrap JavaScript components (like dropdown toggle library handlers) inside Svelte templates. Bootstrap's bundle JavaScript is not imported. Always manage the open/collapsed state of dropdowns, popups, and accordions reactively using Svelte state variables (e.g., `{dropdownOpen ? 'show' : ''}`).
- **Sharp Design System**: Respect the application's sharp design token rules in `app.html` (e.g., `border-radius: 3px !important` is applied globally). Do not specify arbitrary inline curves or border radius styles (like `border-radius: 12px;` or `border-radius: 16px;`) on cards, tables, modals, or buttons.
- **Use Bootstrap Styling**: All interactive components must use proper Bootstrap classes for styling. Avoid custom inline styles that override Bootstrap's theme.
- **Use Modal Component**: For all user input (forms, confirmations, prompts) use the global `Modal` component (`import Modal from '$lib/components/Modal.svelte'`). Never use native browser `prompt()`, `confirm()`, or `alert()` - these are not styled and break the application's UI consistency.
