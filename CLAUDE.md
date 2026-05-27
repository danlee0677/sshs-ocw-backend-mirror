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
| `searchRouter` | `/api/search` | Search across subjects/lessons (requires auth) |
| `cloudinaryRouter` | `/api/image` | Signed Cloudinary upload URL (any authenticated user; admins bypass the per-user rate limit, others are throttled) |
| `permissionRouter` | `/api/permission`, `/api/user/:userId/roles` | Per-subject permission management and global role grants |

### Authentication flow

1. Client calls `/api/auth/login/google?username=<desired>` — a JWT-signed `state` token encodes the desired username.
2. Google redirects to `/api/auth/login/google/callback` — the strategy decodes `state`, creates a new User + Provider record if first-time, then issues tokens.
3. A **refresh token** (JWT, 18 days) is stored as an HTTP-only cookie and in `RefreshModel` (one-time-use with rotation). An **access token** (JWT, 15 min) is returned in the response body.
4. Clients refresh at `/api/auth/refresh` — implements token rotation with a 15s grace period to handle concurrent requests.
5. JWT strategy (`passport-jwt`) validates the `Authorization: Bearer <token>` header and populates `ctx.state.user` as `ContextUser`.

Naver and Kakao strategies exist in the codebase but their callback routes are commented out.

### Authorization

**Global roles** (stored in `User.roles[]`):
- `admin` — full access to everything; the only role that can set `teacher_certified` on subjects and manage global roles.
- `creator` — can create new subjects. Automatically receives an `owner` Permission record on subjects they create.

**Per-subject permissions** (stored in `PermissionModel`):
- `owner` — granted to non-admin subject creators. Can edit/delete the subject and grant/revoke `editor` permissions for other users.
- `editor` — can edit and create/delete lessons within a subject. Granted by an owner or admin.

**Key helper functions:**
- `canEditSubject(user, subjectId)` (in `permissionRouter`) — returns `true` if user is `admin` OR has an `owner`/`editor` Permission record for the subject. Used to gate all write operations on subjects and lessons.
- `canViewStudentOnly(user, subjectId)` (in `lectureRouter`) — returns `true` if user email matches `@sshs.hs.kr`, role is `admin`, or user has an `owner`/`editor` Permission record for the subject. Gates `student_only` lessons and filters lesson lists.

**Permission API endpoints:**
- `GET /api/permission/check/:subjectId` — returns `{ canEdit, role }` for the current user.
- `GET /api/permission/subject/:subjectId` — lists all permission records for a subject (admin only).
- `POST /api/permission` — grants `editor` role to a user for a subject (admin or subject owner only; body: `{ userId, subjectId, role: 'editor' }`).
- `DELETE /api/permission/:permissionId` — revokes an `editor` record (admin or subject owner only; cannot remove `owner` records this way).
- `PATCH /api/user/:userId/roles` — grants or revokes the `creator` global role (admin only; body: `{ grant?: ['creator'], revoke?: ['creator'] }`).

### Data models

- **User** — `username`, `pfp_url`, `roles[]`, `liked_subject[]`, `email`
- **Provider** — links OAuth provider + provider user ID to a User `_id`
- **RefreshModel** — stores issued refresh JWTs with `jti`, `usedAt`, `replacedBy` for rotation/reuse detection
- **Subject** — `title`, `description`, `image_url`, `tags[]`, `likes`, `teacher_certified` (boolean, admin-only write)
- **Lesson** — belongs to a Subject, has `order`, `content`, `student_only`, `createdBy`
- **Permission** — `{ userId, subjectId, role: 'owner' | 'editor' }`, unique index on `(userId, subjectId)`
- **Module / Exercise** — models exist but are not yet used by any router
- **Progress** — records `{ userId, subjectId, lessonId, viewedAt }` upserted on lesson view

### Input validation

All request bodies and query params are validated with **Zod**. Use `.safeParse()` and `ctx.assert(parsed.success, 400)` — the established pattern throughout the codebase.
