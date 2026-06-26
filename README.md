# CoreConnect: Unified HR/CRM

CoreConnect is a modern, unified Human Resources and Customer Relationship Management platform. It features a Next.js frontend and a Node.js/Express/Prisma backend.

## Security Features
This project is configured with several security best practices out of the box:
- **Backend Security Headers**: Configured using `helmet` to protect against cross-site scripting (XSS), clickjacking, and other well-known web vulnerabilities.
- **Backend Rate Limiting**: Enabled via `express-rate-limit` to protect public APIs against brute-force attacks (max 100 requests per 15 minutes per IP).
- **Frontend Security Headers**: The Next.js frontend includes strict HTTP response headers (`X-DNS-Prefetch-Control`, `X-XSS-Protection`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`) for an enhanced security posture.

## Running Locally

### Backend
1. Navigate to the `backend` directory.
2. Ensure you have your environment variables set (`.env` file).
3. Run `npm install`
4. Start the server with `node index.js`. It will run on port 4000.

### Frontend
1. Navigate to the `frontend` directory.
2. Run `npm install`
3. Start the application with `npm run dev`. It will be accessible on port 3000.

## License
All rights reserved. This source code may not be copied, modified, or distributed without explicit permission. See the `LICENSE` file for details.
