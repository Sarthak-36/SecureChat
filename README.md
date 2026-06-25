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
POSTGRES_URL=db_url
JWT_SECRET_KEY=your_secret_key
WS_JWT_SECRET_KEY=ws_secret_key
CLIENT_URL=http://localhost:5173
NODE_ENV=development
COOKIE_SECURE=false
COOKIE_SAME_SITE=lax
HUGGINGFACE_API_KEY=hf_api_key
HF_NSFW_MODEL=Falconsai/nsfw_image_detection
HF_TEXT_MODERATION_MODEL=facebook/roberta-hate-speech-dynabench-r4-target
HF_AI_IMAGE_MODEL=prithivMLmods/deepfake-detector-model-v1
GOOGLE_SAFE_BROWSING_API_KEY=google_safe_browsing_api

#email OTP registration settings
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-email-app-password
```

If you use Gmail for OTP delivery, generate a Gmail App Password and set it in `SMTP_PASS`.

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
- For plain HTTP EC2 deployments, keep `COOKIE_SECURE=false` and `COOKIE_SAME_SITE=lax`.
- For HTTPS deployments with a separate frontend origin, use `COOKIE_SECURE=true` and `COOKIE_SAME_SITE=none`.
