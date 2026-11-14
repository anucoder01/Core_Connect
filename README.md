# CoreConnect: Unified HR/CRM

CoreConnect is a modern, unified Human Resources and Customer Relationship Management platform. It features a Next.js frontend and a Node.js/Express/Prisma backend.

## Operational Features
- Leave requests are checked against the employee's active CRM deals, task deadlines, and latest workload check-in. The API assigns a LOW/MEDIUM/HIGH risk and suggests an available teammate with the lightest active workload, preferring the same department.
- Employer changes to leave, leads, pulse checks, and tasks are written to an indexed audit log. Employers can review recent events and page back through older history.
- Dashboard API reads are scoped by authenticated role and employee ownership. Common assignee, status, and due-date filters are indexed for larger datasets.

## Security Features
This project is configured with several security best practices out of the box:
- **Backend Security Headers**: Configured using `helmet` to protect against cross-site scripting (XSS), clickjacking, and other well-known web vulnerabilities.
- **Backend Rate Limiting**: Enabled via `express-rate-limit` to protect public APIs against brute-force attacks (max 100 requests per 15 minutes per IP).
- **Frontend Security Headers**: The Next.js frontend includes strict HTTP response headers (`X-DNS-Prefetch-Control`, `X-XSS-Protection`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`) for an enhanced security posture.

## Running Locally

### Backend
1. Navigate to the `backend` directory.
2. Copy `.env.example` to `.env` and set a long random `JWT_SECRET`. Keep `.env` private.
3. Run `npm install` and `npx prisma generate`.
4. For a fresh demo database, run `npx prisma db push` and `node seed.js`.
5. Start the server with `node index.js`. It will run on port 4000.

### Frontend
1. Navigate to the `frontend` directory.
2. Set `NEXT_PUBLIC_API_URL` to the backend URL (defaults to `http://localhost:4000`).
3. Run `npm install`.
4. Start the application with `npm run dev`. It will be accessible on port 3000.

The API uses an HTTP-only JWT cookie. Set `FRONTEND_URL` in the backend environment to the exact frontend origin. In production, serve both over HTTPS and use a unique, randomly generated `JWT_SECRET`.

After schema changes, run `npm run db:push` in `backend` to apply additive model and index updates. Keep regular backups of the production database before applying schema changes.

## License
All rights reserved. This source code may not be copied, modified, or distributed without explicit permission. See the `LICENSE` file for details.
