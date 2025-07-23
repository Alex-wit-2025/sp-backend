# sp-backend

This is the backend for the `sp-backend` project, built with [Fastify](https://www.fastify.io/) and TypeScript. It provides REST APIs for user and document management, and supports collaborative editing via [y-websocket](https://github.com/yjs/y-websocket).

## Features

- User authentication and management (Firebase)
- Document CRUD and collaboration endpoints
- Real-time collaboration with y-websocket
- MongoDB and MinIO integration
- TypeScript for type safety

## Requirements

- Node.js 18+
- npm
- Firebase project (for authentication)
- MongoDB instance
- MinIO instance (optional, for file storage)

## Setup

1. **Install dependencies:**
   ```sh
   npm install
   ```

2. **Environment variables:**
   Create a `.env` file in the root directory and add your configuration (Firebase, MongoDB, MinIO, etc).

3. **Run the backend and y-websocket server together:**
   ```sh
   npm run dev
   ```
   This will start both the Fastify backend and a y-websocket server on `localhost:1234`.

## Scripts

- `npm run dev` – Start the backend and y-websocket server for development
- `npm test` – Placeholder for tests

## API Endpoints

### User

- `GET /api/email/:uid` – Get email for a user by UID
- `POST /api/emails/bulk` – Get emails for multiple UIDs  
  **Body:** `{ "uids": ["uid1", "uid2"] }`  
  **Response:** `{ "results": [ { "uid": "uid1", "email": "user1@example.com" }, ... ] }`
- `GET /api/user/documents/:uid` – List documents for a user

### Documents

- `POST /api/documents/add-collaborator/:id/:uid` – Add a collaborator to a document
- `POST /api/documents/remove-collaborator/:id/:uid` – Remove a collaborator from a document
- `POST /api/documents/update/:id/:uid` – Update document content

## Real-time Collaboration

The y-websocket server runs on `localhost:1234` for collaborative editing features.

use `HOST=localhost PORT=1234 npx y-websocket` to run it

## License