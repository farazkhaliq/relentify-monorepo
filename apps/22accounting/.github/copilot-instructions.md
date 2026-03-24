# Copilot Instructions for Relentify MVP

## Project Overview
- Relentify MVP is a Next.js 14 project using TypeScript and Tailwind CSS.
- Designed for containerized deployment with Docker and integration with external networks (infra_default).

## Key Architecture & Patterns
- Uses Next.js App Router (src/app directory structure).
- TypeScript is enforced; strict mode enabled in tsconfig.json.
- Styling via Tailwind CSS, with custom colors and dark mode in tailwind.config.js and globals.css.
- Business logic and reusable components are in src/lib and src/components.
- Healthcheck endpoint at /api/health for Docker monitoring.

## Developer Workflows
- **Local Development:**
  - `npm install` to install dependencies.
  - `npm run dev` to start the development server.
- **Production Build:**
  - `npm run build` then `npm start`.
- **Database Migration:**
  - `npm run db:migrate` for schema updates.
- **Docker Deployment:**
  - `docker-compose up -d --build` for containerized deployment.
  - Use `docker-compose logs -f` to view logs.
  - Rebuild after changes: `docker-compose down && docker-compose up -d --build`.
- **Environment Variables:**
  - Use `.env` for local and containerized development. Add API keys and secrets as needed.

## Customization & Configuration
- Update theme colors in `tailwind.config.js` and `src/app/globals.css`.
- Fonts are set in `src/app/globals.css`.
- Healthcheck endpoint is defined in `src/app/api/health`.

## Integration Points
- Docker Compose connects to infra_default network for shared services.
- Healthcheck endpoint used for container monitoring.

## Conventions
- Use semantic HTML and proper heading hierarchy for SEO.
- All new pages/components should be placed in `src/app/` or `src/components/`.
- Keep business logic in `src/lib/`.

## Example File References
- `src/app/` — Main Next.js app structure
- `src/components/` — Reusable UI components
- `src/lib/` — Business logic
- `tailwind.config.js` — Theme colors
- `docker-compose.yml`, `Dockerfile` — Deployment

## Support
- For issues, contact the development team as noted in the README.

---

**Review these instructions for accuracy and completeness. Suggest improvements if any section is unclear or missing critical details.**
