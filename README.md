# SocialHub — Mini Social Media Platform

A modern, responsive, full-stack mini social media platform built strictly with **HTML5, CSS3, Vanilla JavaScript, Express.js**, and **PostgreSQL**.

Architected from the ground up to be **100% serverless-ready and effortlessly deployable to Vercel**, with zero frontend framework bloat and real relational database backing.

---

## 1. Project Overview

SocialHub delivers a real, interactive social media experience:
- **Authentication & Security:** User registration and login using bcrypt password hashing, secure signed JSON Web Tokens (JWT), and HTTP-only cookies.
- **Profiles:** Customizable user profiles featuring display names, avatars, biographies, post counters, and follower/following counts.
- **Posts Feed:** Full CRUD (Create, Read, Update, Delete) capability for rich text and image posts with instant relative timestamps.
- **Database-Backed Likes:** Real PostgreSQL unique constraints (`user_id`, `post_id`) preventing duplicate likes, accompanied by real-time heart toggle micro-interactions.
- **Dynamic Comments:** Threaded comments underneath posts with instant AJAX submission and owner-only deletion.
- **Follow System:** Relational follow graph (`follower_id`, `following_id`) preventing self-follows and duplicate relationships, powering a personalized "Following" feed.
- **Search & Discovery:** Real database ILIKE search by name or username with responsive debounced input.

---

## 2. Tech Stack

- **Frontend:** HTML5, Custom CSS3 (no Bootstrap/Tailwind dependencies), Vanilla JavaScript (ES6+ `fetch` and async/await).
- **Backend:** Node.js, Express.js (configured for both standalone execution and Vercel Serverless Functions).
- **Database:** PostgreSQL (with Neon / Supabase cloud support + automatic zero-config in-memory fallback for immediate local testing).
- **Authentication:** `bcryptjs` (salt + hash) + `jsonwebtoken` (JWT bearer tokens and cookies).
- **Deployment Target:** [Vercel](https://vercel.com) + [Neon PostgreSQL](https://neon.tech).

---

## 3. Database Architecture

The PostgreSQL schema is located in `db/schema.sql`:

```
+-------------------------------------------------------------+
|                            users                            |
+-------------------------------------------------------------+
| id            SERIAL PRIMARY KEY                            |
| username      VARCHAR(30) UNIQUE NOT NULL                   |
| email         VARCHAR(255) UNIQUE NOT NULL                  |
| password_hash VARCHAR(255) NOT NULL                         |
| name          VARCHAR(100) NOT NULL                         |
| bio           TEXT                                          |
| profile_image TEXT                                          |
| created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()        |
+-------------------------------------------------------------+
        | 1                     | 1
        |                       |
        | N                     | N
+--------------------+   +------------------------------------+
|       posts        |   |              follows               |
+--------------------+   +------------------------------------+
| id          SERIAL |   | id           SERIAL PRIMARY KEY    |
| user_id     INT FK |   | follower_id  INT FK (users)        |
| content     TEXT   |   | following_id INT FK (users)        |
| image_url   TEXT   |   | created_at   TIMESTAMPTZ           |
| created_at  TZ     |   | UNIQUE(follower_id, following_id)  |
+--------------------+   +------------------------------------+
   | 1            | 1
   |              |
   | N            | N
+--------------+  +-------------------------------------------+
|   comments   |  |                   likes                   |
+--------------+  +-------------------------------------------+
| id     SERIAL|  | id         SERIAL PRIMARY KEY             |
| post_id INT FK| | post_id    INT FK (posts)                 |
| user_id INT FK| | user_id    INT FK (users)                 |
| content TEXT |  | created_at TIMESTAMPTZ                    |
+--------------+  | UNIQUE(user_id, post_id)                  |
                  +-------------------------------------------+
```

### Relational Integrity & Safeguards
- `ON DELETE CASCADE`: Deleting a post automatically cleans up its associated likes and comments. Deleting a user cascades to their posts, comments, likes, and follows.
- `UNIQUE (user_id, post_id)` on `likes`: Guarantees at the database engine level that a user can never double-like a post.
- `UNIQUE (follower_id, following_id)` on `follows`: Prevents duplicate follow records.
- `CHECK (follower_id <> following_id)`: Prevents users from following themselves.

---

## 4. Environment Variables

Create a `.env` file in the root directory (refer to `.env.example`):

| Variable | Description | Example |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection URI | `postgresql://user:pass@ep-xyz.neon.tech/neondb?sslmode=require` |
| `SESSION_SECRET` | Secret key for JWT signing & cookies | `your_long_random_secret_string_32_chars` |
| `PORT` | Local dev server port (default: 3000) | `3000` |

*Note: If `DATABASE_URL` is not specified, the app gracefully spins up an in-memory PostgreSQL emulator (`pg-mem`) seeded with initial community data so you can test immediately without setting up external database servers.*

---

## 5. Local Setup & Running

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
*(Optional) If using your own Neon or local PostgreSQL database, paste your connection string into `DATABASE_URL`.*

### Step 3: Start the Application
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Step 4: User Authentication
Users can register a new account on `/register.html` with their name, username, email, and password. Once registered, log in at `/login.html` to create posts, comment, like, and follow other users.

---

## 6. Step-by-Step Vercel Deployment Guide

Deploying to Vercel takes under 3 minutes:

### 1. Create a Free PostgreSQL Database on Neon
1. Go to [Neon.tech](https://neon.tech) and sign in.
2. Create a new project (e.g., `socialhub-db`).
3. Under the **SQL Editor** tab in the Neon dashboard, paste the contents of `db/schema.sql` and click **Run**.
4. (Optional) Run `db/seed.sql` in the SQL Editor to populate sample users and posts.
5. In your Neon dashboard, copy the **Connection string** (`postgresql://...`).

### 2. Push Code to GitHub
```bash
git init
git add .
git commit -m "Initial commit of Mini Social Media Platform"
git remote add origin https://github.com/your-username/mini-social-media.git
git push -u origin main
```

### 3. Deploy on Vercel
1. Log in to [Vercel](https://vercel.com) and click **Add New... -> Project**.
2. Select your GitHub repository and click **Import**.
3. In the **Configure Project** screen:
   - **Framework Preset**: Select `Other` (or leave default).
   - **Root Directory**: `./`
4. Expand **Environment Variables** and add:
   - `DATABASE_URL` = `<your Neon connection string>`
   - `SESSION_SECRET` = `<a random 32-character secret string>`
5. Click **Deploy**.

Vercel will build the project. Once complete, your site will be live at `https://your-project.vercel.app`!
- Frontend static assets are served from `/public` via `vercel.json` rewrites.
- API endpoints are executed serverlessly via `/api/index.js`.

---

## 7. API Reference

All endpoints return uniform JSON responses: `{ "success": true, "data": ... }` or `{ "success": false, "message": ... }`.

### Authentication
- `POST /api/auth/register` — Register new user `{ name, username, email, password, bio }`
- `POST /api/auth/login` — Sign in `{ email or username, password }`
- `GET /api/auth/me` — Retrieve active session user
- `POST /api/auth/logout` — Invalidate session

### Posts
- `GET /api/posts` — Fetch post feed (supports `?feed=following` and `?username=...`)
- `GET /api/posts/:id` — Fetch single post by ID
- `POST /api/posts` — Create post `{ content, image_url }` (requires auth)
- `PUT /api/posts/:id` — Update post (requires author auth)
- `DELETE /api/posts/:id` — Delete post (requires author auth)

### Likes
- `POST /api/posts/:id/like` — Like a post
- `DELETE /api/posts/:id/like` — Unlike a post

### Comments
- `GET /api/posts/:id/comments` — List all comments for a post
- `POST /api/posts/:id/comments` — Add comment `{ content }`
- `DELETE /api/comments/:id` — Delete comment (requires author auth)

### Follows & Users
- `GET /api/users` — List suggested users
- `GET /api/users/search?q=...` — Search users by query
- `GET /api/users/:username` — Get user profile & counters
- `PUT /api/users/:id` — Update profile (requires user auth)
- `POST /api/users/:id/follow` — Follow user
- `DELETE /api/users/:id/follow` — Unfollow user

---

## 8. Directory Structure

```
.
├── api/
│   ├── db.js             # PostgreSQL connection pool & in-memory fallback
│   └── index.js          # Express.js REST API & serverless handler
├── db/
│   ├── schema.sql        # PostgreSQL table definitions, keys & indexes
│   └── seed.sql          # Test accounts, posts, comments & follows
├── public/
│   ├── css/
│   │   └── style.css     # Responsive CSS3 design system
│   ├── js/
│   │   ├── auth.js       # Client authentication & navigation manager
│   │   ├── comments.js   # Dynamic comments handler
│   │   ├── feed.js       # Feed stream controller
│   │   ├── follow.js     # Follow / unfollow interactions
│   │   ├── likes.js      # Real-time like counter & heart toggling
│   │   ├── posts.js      # Post cards rendering & CRUD actions
│   │   └── profile.js    # User profile & bio management
│   ├── explore.html      # Search and user discovery
│   ├── index.html        # Main feed and composer
│   ├── login.html        # Sign-in form with email/username & password
│   ├── profile.html      # Profile view with user posts
│   └── register.html     # Registration form
├── .env.example          # Environment variable template
├── .gitignore            # Git exclusion list
├── metadata.json         # AI Studio applet configuration
├── package.json          # Node.js project manifest & scripts
├── README.md             # Complete documentation & deployment guide
├── server.js             # Local development server entry point
└── vercel.json           # Vercel serverless deployment routing
```

* ## 👩‍💻 Author

**Fatima Javed**

BS Computer Science Student
Aspiring Full-Stack Developer
