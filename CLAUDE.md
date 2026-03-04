# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Run development server (uses tsx for direct TypeScript execution — no build step)
npm run dev

# No test suite is configured
```

There is no production build script. The app runs directly via `npx tsx src/index.ts`.

## Required Environment Variables

See README.md for the full `.env` template. Key variables:

| Variable | Purpose |
|---|---|
| `PORT` | Server port (default 8080) |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` / `JWT_ALGORITHM` | Access token signing (15 min expiry) |
| `REFRESH_JWT_SECRET` | Refresh token signing (18 day expiry) |
| `STATE_SECRET` | Signs the `username` passed through OAuth state param |
| `BASE_API_URL` | Used to construct OAuth callback URLs |
| `FRONTEND_URL` | Redirect target after OAuth login/error |
| `GOOGLE_CLIENT_ID/SECRET` | Google OAuth credentials |
| `CLOUDINARY_*` | Image upload signing |
| `NODE_ENV` | `production` enforces HTTPS-only cookies and `sameSite: none` |

## Architecture

**Stack:** Koa 3 + TypeScript + MongoDB/Mongoose + Passport.js

**Entry point:** [src/index.ts](src/index.ts) — connects to MongoDB, registers Passport strategies, mounts all routers.

### Router modules

| Router | Prefix | Description |
|---|---|---|
| `lectureRouter` | `/api/subjects`, `/api/lessons` | CRUD for subjects and lessons |
| `authRouter` | `/api/auth` | OAuth login, JWT refresh, logout, verify |
| `progressRouter` | `/api/progress` | Tracks which lessons a user has viewed |
| `userRouter` | `/api/user` | User profile fetch/delete |
| `searchRouter` | `/api/search` | Regex search across subjects/lessons |
| `cloudinaryRouter` | `/api/image` | Signed Cloudinary upload URL (admin only) |

### Authentication flow

1. Client calls `/api/auth/login/google?username=<desired>` — a JWT-signed `state` token encodes the desired username.
2. Google redirects to `/api/auth/login/google/callback` — the strategy decodes `state`, creates a new User + Provider record if first-time, then issues tokens.
3. A **refresh token** (JWT, 18 days) is stored as an HTTP-only cookie and in `RefreshModel` (one-time-use with rotation). An **access token** (JWT, 15 min) is returned in the response body.
4. Clients refresh at `/api/auth/refresh` — implements token rotation with a 15s grace period to handle concurrent requests.
5. JWT strategy (`passport-jwt`) validates the `Authorization: Bearer <token>` header and populates `ctx.state.user` as `ContextUser`.

Naver and Kakao strategies exist in the codebase but their callback routes are commented out.

### Authorization

- `passport.authenticate('jwt', { session: false })` — requires a valid access token.
- `optionalAuth` (exported from `lectureRouter`) — attaches user if token is present but doesn't reject unauthenticated requests.
- Role `admin` — required for all write operations (create/edit/delete subjects, lessons, upload images).
- `canViewStudentOnly(user)` — returns true if user email matches `@sshs.hs.kr` or role is `admin`. Gates `student_only` lessons from public access.

### Data models

- **User** — `username`, `pfp_url`, `roles[]`, `liked_subject[]`, `email`
- **Provider** — links OAuth provider + provider user ID to a User `_id`
- **RefreshModel** — stores issued refresh JWTs with `jti`, `usedAt`, `replacedBy` for rotation/reuse detection
- **Subject** — `title`, `description`, `image_url`, `tags[]`, `likes`
- **Lesson** — belongs to a Subject, has `order`, `content`, `student_only`, `createdBy`
- **Module / Exercise** — models exist but are not yet used by any router
- **Progress** — records `{ userId, subjectId, lessonId, viewedAt }` upserted on lesson view

### Input validation

All request bodies and query params are validated with **Zod**. Use `.safeParse()` and `ctx.assert(parsed.success, 400)` — the established pattern throughout the codebase.