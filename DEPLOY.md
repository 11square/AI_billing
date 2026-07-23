# Deploy to Railway — step by step

This app is a Node/Express + Sequelize backend serving a static SPA from
`public/`. Railway is the smoothest fit: native MySQL, one-click GitHub
deploys, ~5-minute setup end to end.

**You need:** a GitHub account (you already have one — you own this repo),
and a Railway account with a payment method on file (they give $5 trial
credit; this app uses maybe $2–$4/month at low traffic).

---

## 1. Push your code

Already done — this branch is on `main` of `github.com/11square/AI_billing`.
If you make local edits later, `git push` and Railway auto-deploys.

## 2. Sign into Railway

- Go to **https://railway.app**
- Click **Login** → **Login with GitHub**
- Authorise Railway to see your repositories

## 3. Create a new project

- On the Railway dashboard click **New Project**
- Pick **Deploy from GitHub repo**
- Select **11square/AI_billing** (grant repo access if prompted)
- Railway starts a first build. **It will fail** — that's fine; we haven't
  added the database yet. Ignore the red X and move on.

## 4. Add MySQL

- Inside the same project, click **+ New** → **Database** → **Add MySQL**
- Wait ~30 seconds for it to provision. You'll see two services now: your
  app (blue box) and MySQL (grey box).

## 5. Wire the environment variables

- Click the **app service** (not MySQL) → **Variables** tab → **Raw Editor**
- Paste this in (adjust `JWT_SECRET` to something random):

  ```env
  NODE_ENV=production
  JWT_SECRET=replace-with-a-long-random-string-of-your-choice
  JWT_EXPIRE=7d
  DB_HOST=${{ MySQL.MYSQLHOST }}
  DB_PORT=${{ MySQL.MYSQLPORT }}
  DB_NAME=${{ MySQL.MYSQLDATABASE }}
  DB_USER=${{ MySQL.MYSQLUSER }}
  DB_PASSWORD=${{ MySQL.MYSQLPASSWORD }}
  DB_SYNC=alter
  ```

- Click **Update Variables**. Railway rebuilds automatically.

## 6. Wait for the healthcheck to go green (~1 min)

- **Deployments** tab → most recent deploy should show **Success** (green).
- If it's stuck, click into the deployment → **View Logs** → look for
  `✅ MySQL connected` and `🚀 Server listening on port…`.

## 7. Open the app

- **Settings** tab → **Networking** → click **Generate Domain**
- Railway gives you a URL like `ai-billing-production.up.railway.app`
- Open it — the login screen loads.

## 8. Seed the admin user (once)

The database is empty. You need one admin account to log in.

- In Railway, open the **app service** → **Deployments** → latest → **Shell**
  (small `>_` icon top-right of the deploy details).
- Run:

  ```bash
  npm run seed:cafe
  ```

  This creates:
  - Admin login: **`admin@cafe.com`** / **`admin123`**
  - 100 sample menu items
  - Sample staff + customers

- Log in with those credentials at your Railway URL.

## 9. Turn off DB_SYNC (recommended)

Once the first deploy is up and the schema exists, unset `DB_SYNC` so
future restarts don't try to alter the schema:

- **Variables** tab → find `DB_SYNC` → click the trash icon → **Update**.
- The next deploy will just start faster; nothing else changes.

---

## Editing the app after it's live

**Frontend (`public/`):**
- Edit HTML/CSS/JS locally
- `git add . && git commit -m "your change" && git push`
- Railway auto-redeploys in ~1 min

**Backend (`routes/`, `models/`, `services/`):**
- Same flow — edit, commit, push
- If you added a new column to a model, temporarily re-set `DB_SYNC=alter`
  for one deploy so Sequelize creates the column, then remove it again

**Direct DB access:**
- Click **MySQL** service → **Connect** tab
- Copy the connection string
- Use any MySQL client (TablePlus, DBeaver, `mysql` CLI) to inspect / edit
  data directly

---

## Troubleshooting

**Build fails with "Cannot find module"**
- Check `package.json` — make sure every `require(...)` in your code
  matches a dependency listed there. Locally, `npm install <pkg>` and push.

**Healthcheck timeout**
- Logs show `Database connection error` — verify the 5 `DB_*` env vars are
  wired via `${{ MySQL.MYSQLXXXX }}` references, not raw values.

**Login says "wrong email or password" on the freshly-deployed app**
- You skipped step 8 (`npm run seed:cafe`). Run it from the deploy shell.

**Table not found errors after adding a new model**
- Set `DB_SYNC=alter` in env vars, redeploy once, then remove the var.

**"Reset" the entire database**
- MySQL service → **Data** tab → tables list → select all → **Drop**.
- Redeploy the app with `DB_SYNC=alter` to recreate the schema.
- Re-run `npm run seed:cafe` in the shell.

---

## Costs

- App service (Node): ~$0.50–$2/month at low traffic
- MySQL: ~$1–$3/month at low traffic
- Total: **~$2–$5/month** after the $5 trial credit runs out. Railway
  emails you well before charging.

If you want to pause billing:
- Project **Settings** → **Danger** → **Delete project** (deletes MySQL too — export first)
- Or lower the app's memory / MySQL storage in each service's Settings tab.
