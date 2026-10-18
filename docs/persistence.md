# Persistence: local-first, with optional accounts

Melody Masters needs **no database**. Storage works in three tiers.

| Mode | When | Where data lives | Status |
| --- | --- | --- | --- |
| **Local-first** (default) | No `DATABASE_URL` | Browser: IndexedDB for history and progress, localStorage for preferences, in-memory fallback if both are blocked | Built in |
| **Remote (PostgreSQL)** | `DATABASE_URL` set | Your Postgres, accessed through Prisma 7 with `@prisma/adapter-pg` | Built in, optional |
| **SQLite** | Single-machine self-hosting | A local `.db` file | Documented below, not shipped |

UI components never talk to storage directly. They go through the repositories in `src/lib/storage/repositories.ts`, which use the `StorageAdapter` interface (`src/lib/storage/adapter.ts`). Because of that, switching adapters (`setAdapter(...)`) doesn't need any UI changes. `src/lib/storage/remote-adapter.ts` is an adapter backed by the sync API. It exists so the app can later run directly against an account, but it isn't enabled by default.

## Local-first mode

- Nothing to configure. `npm install && npm run dev` is enough.
- Settings → Account shows "Your progress is saved on this device".
- When no database is configured, every account and sync API route returns `503 { enabled: false }`. The exception is `GET /api/auth/me`, which returns `200 { enabled: false, user: null }` so the UI can check without logging an error.
- Data versioning and migrations run in the browser (`ensureMigrated()` in `src/lib/storage/db.ts`). Malformed rows are skipped and never crash the app.

## Remote mode (PostgreSQL)

```bash
cp .env.example .env.local        # set DATABASE_URL=postgresql://…
npm run db:migrate                # prisma migrate deploy (applies prisma/migrations)
npm run db:seed                   # loads courses, lessons, exercises and quiz questions from src/content/curriculum
npm run dev
```

During development you can change the schema with `npm run db:migrate:dev`.

### Prisma client generation

The client is generated into `src/generated/prisma`, which is gitignored. Generation runs from the `postinstall` script (`prisma generate`) and also as `npm run db:generate`.

- `prisma generate` needs **no database and no `DATABASE_URL`**. Prisma 7 uses the TypeScript and WASM query compiler, so there is no engine to download at runtime. A fresh `npm install` therefore leaves the project ready to build even in local-first mode.
- If you install with `--ignore-scripts`, run `npm run db:generate` once before `npm run build`.
- The server loads the client lazily (`src/lib/server/db/index.ts`), and only once `DATABASE_URL` is set. In local-first mode Prisma is never imported at runtime.

### Schema overview (`prisma/schema.prisma`)

- **Accounts:** `User`, `Session` (stores only a SHA-256 of the token), `UserPreferences` (prefs, profile and goals as JSON), `InstrumentProfile`.
- **Catalogue (seeded):** `Course`, `Lesson`, `Exercise`, `QuizQuestion`.
- **Progress:** `LessonCompletion`, `PracticeSession`, `AssessmentAttempt` (quiz and measured exercise results), `SkillMastery`, `SavedSong`, `SongProgress`, `SavedVideo`, `ChordDrillResult`, `Transposition`, `CoachMessage`.

Rows created on a device keep their device-generated id, but under a composite key `(userId, id)`. A user can never overwrite another user's rows. Microphone audio is never stored.

### Auth

- Email and password. Passwords are hashed with scrypt from `node:crypto` (N=16384, r=8, p=1, 16-byte salt) and compared in constant time. When the email doesn't exist, the server still hashes against a dummy value so timing doesn't reveal which emails are registered.
- Sessions use 256-bit random tokens in an `mm_session` cookie (httpOnly, SameSite=Lax, Secure in production) and expire after 30 days. The database stores only the token's hash.
- Rate limits are kept in memory per server instance: login 10 per 15 minutes per IP, register 5 per hour per IP, sync 30 per minute per user. Use a shared store such as Redis if you run several instances.
- POST routes reject cross-origin `Origin` headers.
- Optional Google sign-in uses OAuth 2.0 authorization code with PKCE (S256) and `state`. It turns on when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set. The redirect URI is `<APP_URL>/api/auth/google/callback`. A Google account is linked to an existing account with the same email only if Google reports that email as verified.

### Sync: moving local progress into an account

Nothing is ever overwritten silently.

1. **Upload.** The device exports its data (`exportAll()`) and posts it to `POST /api/sync` with `dryRun: true`. The server answers with a plan: `added`, `identical` and `conflicts`.
2. The student chooses what happens:
   - **keep-uploaded:** replace conflicting rows with this device's copy.
   - **keep-server:** add only new rows.

   If a POST has no strategy and there are conflicts, the server responds `409` with the plan and writes nothing.
3. **Download.** `GET /api/sync` returns the account's data in the same `ExportBundle` format. Next, `planImport()` runs a dry run on the device. Finally, `applyImport()` runs with the student's choice: `keep-local` or `keep-imported`. Importing account settings is a separate opt-in checkbox.

Uploads are validated with the same zod schemas the device uses. Invalid rows are skipped and reported. A body may be at most 2 MB, with at most 5000 rows per collection.

## SQLite (advanced, not shipped)

SQLite isn't a dependency because the main schema uses Postgres features that SQLite lacks, such as `String[]` scalar lists and native enums. To run on a single machine with a file database:

1. Copy the schema to `prisma/sqlite/schema.prisma` and set `provider = "sqlite"`. Store each list as `Json`, or as a JSON-encoded `String`. Replace each enum with a `String`.
2. `npm i @prisma/adapter-better-sqlite3 better-sqlite3`, then construct `new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: "file:./data/melody.db" }) })` in `src/lib/server/db/index.ts`. Switch on the URL scheme (`file:`).
3. Adapt the list conversions in `src/lib/server/db/sync.ts`.

Caveats:

- The SQLite file lives on the server. Browser code never reads it directly, and local-first browser storage stays independent of it.
- **Serverless hosting** (Vercel, Netlify functions and similar) has an ephemeral, read-only or per-instance filesystem. A SQLite file there will **not persist**. Use hosted Postgres instead, for example Neon, Supabase or RDS.
- Serverless Postgres: use a pooled connection string where your provider offers one, because each function instance opens its own pool.
