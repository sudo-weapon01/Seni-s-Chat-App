# Seni Chat

A modern, full-stack 1-on-1 real-time chat application built with Next.js, Express, Socket.IO, and Knex.

Supports **SQLite** (zero-config local default), **PostgreSQL**, and **MySQL**. The database auto-migrates upon startup so you can start chatting immediately.

---

## Architecture

```
frontend (Next.js 16 + React 18, port 3000)
  ├── Modern luxury glassmorphism UI & responsive sidebar
  ├── JSON REST API client + Bearer JWT / httpOnly cookie
  └── Socket.IO client (presence, typing wave, live delivery, read receipts)
        │
backend (Express 4 + Node 18+, port 4000)
  ├── src/routes        HTTP REST endpoints
  ├── src/controllers   Controller handlers
  ├── src/services      Domain business logic + batched SQL queries
  ├── src/sockets       Real-time WebSocket presence & room events
  ├── src/middleware    Auth, rate limiting, XSS sanitization, HPP, validation
  └── Knex ORM          SQLite (default), PostgreSQL, or MySQL
```

### Core Features

- **Real-Time Messaging**: Instant bidirectional messaging via Socket.IO.
- **Message Replies & Quotes**: Quote parent messages with contextual previews and scroll-jumping.
- **Emoji Reactions**: Real-time emoji reaction pills (`❤️`, `👍`, `😂`, `🔥`, `🎉`, `😮`) with instant toggling.
- **Presence & Live Typing**: Real-time online/offline indicators and animated typing wave.
- **Delivery & Read Receipts**: Visual status checkmarks (`✓ Sent`, `✓✓ Seen`).
- **Message Editing & History**: Edit your messages with full audit trail history inspection.
- **Soft Deletion**: Message deletion preserving thread continuity.
- **Fast Sidebar Filtering**: Real-time client filter across active chat threads.
- **Zero-Config Database**: Defaults to SQLite for immediate plug-and-play development, with 1-click configuration for PostgreSQL or MySQL.
- **Hardened Security**: Helmet, CORS allowlist, HTTP Parameter Pollution protection, XSS sanitization, bcrypt (12 rounds), JWT tokens, and rate limits.

---

## Quickstart (Under 1 Minute)

### 1. Start Backend

```bash
cd backend
npm install
npm run dev
```

*Note: Migrations run automatically on startup! The API will be active on `http://localhost:4000`.*

To run the automated end-to-end integration test suite:

```bash
npm test
```

### 2. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Database Configuration

The backend supports three database engines via `DB_CLIENT` in `backend/.env`:

### Option A: SQLite (Default — Zero Config)
```env
DB_CLIENT=sqlite3
DB_FILENAME=seni_chat.sqlite
```
No external database server installation required. A local database file is created automatically.

### Option B: PostgreSQL
1. Create a database:
   ```sql
   CREATE DATABASE seni_chat;
   ```
2. Configure `.env`:
   ```env
   DB_CLIENT=pg
   DB_HOST=127.0.0.1
   DB_PORT=5432
   DB_NAME=seni_chat
   DB_USER=postgres
   DB_PASSWORD=your_password
   ```

### Option C: MySQL
1. Create a database:
   ```sql
   CREATE DATABASE seni_chat CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
2. Configure `.env`:
   ```env
   DB_CLIENT=mysql2
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_NAME=seni_chat
   DB_USER=root
   DB_PASSWORD=your_password
   ```

---

## HTTP REST API (`/api`)

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | No | Register new user account |
| `POST` | `/api/auth/login` | No | Authenticate with username/email & password |
| `POST` | `/api/auth/logout` | No | Clear authentication cookie |
| `GET`  | `/api/auth/me` | Yes | Get currently authenticated user |
| `GET`  | `/api/users/search?q=` | Yes | Search users by username or email |
| `GET`  | `/api/users/:id` | Yes | Get public profile of a user |
| `PATCH`| `/api/users/me` | Yes | Update bio or avatar URL |
| `GET`  | `/api/conversations` | Yes | List conversations (batched query optimized) |
| `POST` | `/api/conversations` | Yes | Get or create 1-on-1 thread `{ userId }` |
| `GET`  | `/api/conversations/:id/messages` | Yes | Retrieve message history |
| `POST` | `/api/conversations/:id/messages` | Yes | Send message `{ body, replyToId }` |
| `POST` | `/api/conversations/:id/read` | Yes | Mark incoming messages read |
| `PATCH`| `/api/messages/:id` | Yes | Edit own message |
| `DELETE`| `/api/messages/:id` | Yes | Soft delete own message |
| `GET`  | `/api/messages/:id/history` | Yes | Inspect message edit history |
| `POST` | `/api/messages/:id/reactions` | Yes | Toggle emoji reaction `{ emoji }` |

---

## WebSocket Events

### Client → Server
- `conversation:join`: Join real-time room for thread
- `conversation:leave`: Leave thread room
- `typing:start`: Notify peer that user is typing
- `typing:stop`: Notify peer that user stopped typing
- `conversation:read`: Mark messages read via socket
- `reaction:toggle`: Toggle emoji reaction via socket `{ messageId, emoji }`
- `presence:query`: Query online status for list of user IDs

### Server → Client
- `message:new`: Delivered when a new message is posted (includes `replyTo` if quoted)
- `message:edited`: Delivered when a message is updated
- `message:deleted`: Delivered when a message is soft-deleted
- `reaction:update`: Real-time reaction updates `{ messageId, reactions }`
- `typing:update`: Live typing updates for peer
- `presence:update`: Live online/offline status changes
- `receipt:update`: Real-time read receipt delivery
