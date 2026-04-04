# Copilot Instructions for Inventory App

## Project Overview
- Inventory App is a Next.js 14 project using TypeScript and Tailwind CSS.
- Designed for containerized deployment with Docker and integration with infra_default network.
- Uses Prisma for database access and migrations.

## Key Architecture & Patterns
- Uses Next.js App Router (app directory structure).
- TypeScript is enforced throughout.
- Styling via Tailwind CSS, with theme configuration in tailwind.config.ts and app/globals.css.
- Business logic and reusable components are in lib and components directories.
- Prisma schema and migrations are in prisma/.

## Developer Workflows
- **Local Development:**
  - `npm install` to install dependencies.
  - `npm run dev` to start the development server.
- **Production Build:**
  - `npm run build` then `npm start`.
- **Docker Deployment:**
  - `docker-compose up -d --build` for containerized deployment.
  - Use `docker-compose logs -f` to view logs.
  - Rebuild after changes: `docker-compose down && docker-compose up -d --build`.
- **Database Migration:**
  - Use Prisma CLI for schema updates.
- **Environment Variables:**
  - Use `.env` for local and containerized development. Add API keys and secrets as needed.

## Customization & Configuration
- Update theme colors in `tailwind.config.ts` and `app/globals.css`.
- Fonts are set in `app/layout.tsx`.
- Prisma schema is defined in `prisma/schema.prisma`.

## Integration Points
- Docker Compose connects to infra_default network for shared services.
- Database connection via Prisma and environment variables.

## Conventions
- Use semantic HTML and proper heading hierarchy for SEO.
- All new pages/components should be placed in `app/` or `components/`.
- Keep business logic in `lib/`.

## Example File References
- `app/` — Main Next.js app structure
- `components/` — Reusable UI components
- `lib/` — Business logic
- `prisma/` — Database schema and migrations
- `tailwind.config.ts` — Theme colors
- `docker-compose.yml`, `Dockerfile` — Deployment

## Support
- For issues, contact the development team as noted in the README.

---

**Review these instructions for accuracy and completeness. Suggest improvements if any section is unclear or missing critical details.**
