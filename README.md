# Fullstack Chat App with some security features

Highlights:

- Real-time messaging over WebSockets
- 1-on-1 browser video calling with WebRTC signaling over WebSockets
- JWT authentication with protected routes
- Tech stack: React + Express + PostgreSQL + TailwindCSS
- Global state management with Zustand

## Environment Setup

### Backend (`/backend`)

```env
PORT=5001
POSTGRES_URL=postgres://postgres:postgres@localhost:5432/SecureChat
JWT_SECRET_KEY=your_jwt_secret
WS_JWT_SECRET_KEY=optional_dedicated_websocket_secret
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

### Frontend (`/frontend`)

No required environment variables for the new realtime flow.

## Run the Backend

```bash
cd backend
npm install
npm run dev
```

## Run the Frontend

```bash
cd frontend
npm install
npm run dev
```

## Notes

- The backend now bootstraps its own PostgreSQL tables on startup.
- Chat history is stored in PostgreSQL in the `messages` table.
- Friend relationships and friend requests are also stored in PostgreSQL.
- Video calls use browser-native WebRTC with a WebSocket signaling channel.
