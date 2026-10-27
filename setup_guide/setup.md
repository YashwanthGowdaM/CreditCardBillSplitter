# 🛠 CardSplit — Detailed Setup Guide

A complete, beginner-friendly walkthrough. Every step tells you **what to type**, **what it does**, and **what you should see**.

> 💡 **Tip:** If a command's output looks a little different from the examples here (different version numbers, timestamps, IDs) — that is normal. Only the overall shape matters.

---

## 📑 Table of Contents

1. [What you are going to build](#1-what-you-are-going-to-build)
2. [Prerequisites — install Docker](#2-prerequisites--install-docker)
3. [Get the project files](#3-get-the-project-files)
4. [Configure your settings (`.env`)](#4-configure-your-settings-env)
5. [**Option A** — Run everything with Docker Compose (recommended)](#5-option-a--run-everything-with-docker-compose-recommended)
6. [Open and use the application](#6-open-and-use-the-application)
7. [Verify each microservice](#7-verify-each-microservice)
8. [**Option B** — Run the three services one by one with their Dockerfiles](#8-option-b--run-the-three-services-one-by-one-with-their-dockerfiles)
9. [**Option C** — Develop without rebuilding images (optional)](#9-option-c--develop-without-rebuilding-images-optional)
10. [Everyday commands](#10-everyday-commands)
11. [Backup & restore your data](#11-backup--restore-your-data)
12. [Moving your data from the old version](#12-moving-your-data-from-the-old-version)
13. [Reset everything](#13-reset-everything)
14. [Troubleshooting](#14-troubleshooting)
15. [Security checklist](#15-security-checklist)

---

## 1. What you are going to build

You will run **three containers** that work together:

```text
 Your browser  ──►  FRONTEND  ──►  BACKEND  ──►  DATABASE
 localhost:3000     (Nginx +       (Node.js +     (PostgreSQL 16)
                     React)         Express)       data saved in a Docker volume
```

| Container name | What it does | Reachable from your computer? |
|---|---|---|
| `cardsplit-frontend` | Shows the web app and forwards `/api` requests to the backend | ✅ `http://localhost:3000` |
| `cardsplit-backend` | The REST API — talks to the database | ✅ `http://localhost:5000` (for testing) |
| `cardsplit-database` | Stores all cards, people, bills and transactions | ❌ private (backend only) |

**There are three ways to run it.** Pick one:

| Option | Best for | Difficulty |
|---|---|---|
| **A — Docker Compose** | Everyone. One command starts everything | ⭐ Easy |
| **B — Individual Dockerfiles** | Learning how each service is built and connected | ⭐⭐ Medium |
| **C — Local development** | Editing the code with live reload | ⭐⭐⭐ Advanced |

---

## 2. Prerequisites — install Docker

You only need **Docker**. You do **not** need to install Node.js or PostgreSQL.

### 🪟 Windows 10 / 11

1. Download **Docker Desktop** from <https://www.docker.com/products/docker-desktop/>
2. Run the installer. Keep **"Use WSL 2 instead of Hyper-V"** ticked if it is offered.
3. Restart your computer if asked.
4. Start **Docker Desktop** from the Start menu and wait until the whale icon in the system tray stops animating and the window says **"Engine running"**.
5. Use **PowerShell** (or Windows Terminal) for the commands in this guide.

### 🍎 macOS

1. Download **Docker Desktop** for your chip (Apple Silicon or Intel) from <https://www.docker.com/products/docker-desktop/>
2. Drag it into **Applications** and open it.
3. Wait until it says **"Engine running"**.
4. Use the **Terminal** app for the commands in this guide.

### 🐧 Linux (Ubuntu / Debian etc.)

1. Install **Docker Engine** and the **Compose plugin** by following the official instructions for your distribution: <https://docs.docker.com/engine/install/>
2. Allow your user to run Docker without `sudo`:

   ```bash
   sudo usermod -aG docker $USER
   ```

3. **Log out and log back in** (this is required for the change to apply).

### ✅ Check that Docker works

Open a terminal and run:

```bash
docker --version
```

Expected output (your version number will differ):

```text
Docker version 27.3.1, build ce12230
```

Then:

```bash
docker compose version
```

Expected output:

```text
Docker Compose version v2.29.7
```

Finally, make sure the Docker engine is actually running:

```bash
docker run --rm hello-world
```

Expected output (shortened):

```text
Hello from Docker!
This message shows that your installation appears to be working correctly.
```

> ❗ If you see `Cannot connect to the Docker daemon` or `error during connect`, Docker is installed but **not running**. Start Docker Desktop (Windows/macOS) or run `sudo systemctl start docker` (Linux), then try again.

---

## 3. Get the project files

1. Unzip the project (right-click → **Extract All** on Windows, double-click on macOS, or `unzip CardSplit-Microservices.zip` on Linux).
2. Open a terminal **inside** the project folder:

   ```bash
   cd CardSplit-Microservices
   ```

3. Confirm you are in the right place:

   ```bash
   ls
   ```

   *(On Windows PowerShell you can also use `dir`.)*

   Expected output:

   ```text
   README.md   backend   database   docker-compose.yml   frontend   setup_guide
   ```

   > The hidden files `.env.example` and `.gitignore` are also there; `ls -a` shows them.

Your folder layout is:

```text
CardSplit-Microservices/
├── docker-compose.yml
├── .env.example
├── README.md
├── setup_guide/setup.md
├── database/    (Dockerfile + init/01-schema.sql)
├── backend/     (Dockerfile + package.json + src/)
└── frontend/    (Dockerfile + nginx.conf.template + package.json + src/)
```

---

## 4. Configure your settings (`.env`)

Docker Compose reads your passwords and ports from a file called **`.env`**. A template called `.env.example` is included.

### Step 4.1 — Create your `.env` file

**macOS / Linux:**

```bash
cp .env.example .env
```

**Windows PowerShell:**

```powershell
Copy-Item .env.example .env
```

There is no output when it succeeds. Check that the file exists:

```bash
ls -a        # macOS / Linux          (Windows: dir -Force)
```

You should see `.env` in the list.

### Step 4.2 — Edit it

Open `.env` in any text editor (Notepad, VS Code, nano…). It looks like this:

```ini
ADMIN_PASSWORD=change-me-admin-password

DB_NAME=cardsplit
DB_USER=cardsplit
DB_PASSWORD=change-me-db-password

FRONTEND_PORT=3000
BACKEND_PORT=5000

CORS_ORIGIN=*
```

**Change at least these two values:**

| Variable | What to do |
|---|---|
| `ADMIN_PASSWORD` | Choose the master password you will type in the app to unlock editing. |
| `DB_PASSWORD` | Choose any strong password. You will never type it yourself — the backend uses it. |

Save the file.

> ⚠️ **Important:** the database user and password are set **only the first time** the database starts. If you change `DB_PASSWORD` later, you must reset the database volume (see [Reset everything](#13-reset-everything)). `ADMIN_PASSWORD` can be changed any time.

> ℹ️ **If a port is already used** on your computer (for example you already run something on 3000), change `FRONTEND_PORT` / `BACKEND_PORT` here (e.g. `FRONTEND_PORT=8080`) and use that number in the browser.

---

## 5. Option A — Run everything with Docker Compose (recommended)

### Step 5.1 — Build and start

From the project folder (where `docker-compose.yml` is):

```bash
docker compose up -d --build
```

What the flags mean:

- `up` — create and start the containers
- `-d` — "detached": run in the background and give you your terminal back
- `--build` — build the three images from their Dockerfiles first

⏱ **The first run takes a few minutes.** Docker downloads the base images (PostgreSQL, Node, Nginx), installs the dependencies and compiles the web app. Later runs take seconds because Docker caches the work.

You will see a lot of build progress. When it finishes, the end of the output looks like this:

```text
[+] Running 5/5
 ✔ Network cardsplit_app-net     Created
 ✔ Volume "cardsplit_pgdata"     Created
 ✔ Container cardsplit-database  Healthy
 ✔ Container cardsplit-backend   Healthy
 ✔ Container cardsplit-frontend  Started
```

The **order matters and is automatic**: the database starts first, the backend waits until the database is healthy, and the frontend waits until the backend is healthy.

### Step 5.2 — Check the containers

```bash
docker compose ps
```

Expected output (wait ~20 seconds and run it again if you see `starting`):

```text
NAME                 IMAGE                    SERVICE    STATUS                    PORTS
cardsplit-backend    cardsplit/backend:1.0    backend    Up 30 seconds (healthy)   0.0.0.0:5000->5000/tcp
cardsplit-database   cardsplit/database:1.0   database   Up 40 seconds (healthy)   5432/tcp
cardsplit-frontend   cardsplit/frontend:1.0   frontend   Up 25 seconds (healthy)   0.0.0.0:3000->80/tcp
```

✅ All three must say **`(healthy)`**.

### Step 5.3 — Look at the backend log (optional but reassuring)

```bash
docker compose logs backend
```

Expected output:

```text
cardsplit-backend  | [db] connected to database:5432/cardsplit
cardsplit-backend  | [api] CardSplit backend listening on port 5000
```

If you left `ADMIN_PASSWORD` at the default you will also see a `[security]` warning asking you to change it.

**🎉 Setup done. Continue to [Open and use the application](#6-open-and-use-the-application).**

---

## 6. Open and use the application

### Step 6.1 — Open the app

Go to **<http://localhost:3000>** in your browser (use your own port if you changed `FRONTEND_PORT`).

You should see a **Welcome to CreditSplit** pop-up. Click **"Got it! Start Using App"**.

In the top-right corner, the status badge should read **"API & Database Connected"** (green).

> 🔴 If it says **"Backend Offline"**, jump to [Troubleshooting](#14-troubleshooting).

### Step 6.2 — Unlock editing

The app starts in **Protected Mode**: you can look around, but adding or changing data needs the admin password.

1. Click **Protected Mode** (top right).
2. Type the `ADMIN_PASSWORD` you set in `.env`.
3. Click **Verify & Unlock**. The badge changes to **Admin Unlocked**.

### Step 6.3 — First-use walkthrough

1. **Credit Cards** tab → **Add Credit Card** → enter issuer (e.g. *HDFC*), card name, network, statement date, bill due date → save.
2. **People** tab → **Add Person** → add the friends / flatmates / family who share expenses.
3. **Bill Sorting** tab → pick your card and select its PDF statement (the **Practice Bills** button in the top bar links to sample files) → review the extracted debit transactions → confirm the import.
4. In the combined table, use the **dropdown on each row** to assign the transaction to a person.
5. **My Share** tab → pick a person → **Generate PDF** to download their itemised statement.

Close the browser and open it again — **your data is still there**, because it is stored in the database, not in the browser.

---

## 7. Verify each microservice

These optional checks prove that every piece works on its own — a great way to understand how the services fit together.

> 🪟 **Windows PowerShell users:** in PowerShell, `curl` is an alias for a different command. Type **`curl.exe`** instead of `curl` in the examples below.

### 7.1 Backend health

```bash
curl http://localhost:5000/api/health
```

Expected output:

```json
{"status":"ok","service":"cardsplit-backend","database":"connected","uptimeSeconds":42}
```

`"database":"connected"` proves the backend can talk to PostgreSQL.

### 7.2 Frontend → backend proxy

The same API is also reachable through the frontend container (this is the path the browser uses):

```bash
curl http://localhost:3000/api/health
```

Expected: the same JSON as above.

### 7.3 Reading data (no password needed)

```bash
curl http://localhost:5000/api/cards
```

Expected on a fresh install:

```json
[]
```

### 7.4 Writing data requires the admin password

Without the password:

```bash
curl -X POST http://localhost:5000/api/cards \
  -H "Content-Type: application/json" \
  -d '{"issuer":"HDFC","card_name":"Millennia","network":"Visa","bill_due_date":"11th","statement_date":"20th"}'
```

Expected output (HTTP 401):

```json
{"error":"Admin authorization required. Unlock the app with the admin password."}
```

With the password (replace `YOUR_ADMIN_PASSWORD`):

```bash
curl -X POST http://localhost:5000/api/cards \
  -H "Content-Type: application/json" \
  -H "x-admin-password: YOUR_ADMIN_PASSWORD" \
  -d '{"issuer":"HDFC","card_name":"Millennia","network":"Visa","bill_due_date":"11th","statement_date":"20th","last_4_digits":"1234"}'
```

Expected output (the `id` and dates will differ):

```json
{"id":"0b6f4f0e-5d0a-4c3e-9a57-3a1b6c8e2f11","issuer":"HDFC","card_name":"Millennia","network":"Visa","bill_due_date":"11th","statement_date":"20th","last_4_digits":"1234","created_at":"2026-10-27T10:15:00.000Z","updated_at":"2026-10-27T10:15:00.000Z"}
```

> 🪟 In PowerShell the backslash `\` line continuation does not work — put the whole command on **one line**.

Refresh the **Credit Cards** tab in the browser — the card you just created through the API appears. 

### 7.5 Look inside the database

```bash
docker compose exec database psql -U cardsplit -d cardsplit -c "\dt"
```

*(If you changed `DB_USER` / `DB_NAME` in `.env`, use those values here.)*

Expected output:

```text
                List of relations
 Schema |          Name           | Type  |   Owner
--------+-------------------------+-------+-----------
 public | cards                   | table | cardsplit
 public | people                  | table | cardsplit
 public | transaction_assignments | table | cardsplit
 public | transactions            | table | cardsplit
 public | uploaded_bills          | table | cardsplit
(5 rows)
```

See your cards:

```bash
docker compose exec database psql -U cardsplit -d cardsplit -c "SELECT issuer, card_name, network FROM cards;"
```

Expected output (if you created the card above):

```text
 issuer | card_name | network
--------+-----------+---------
 HDFC   | Millennia | Visa
(1 row)
```

---

## 8. Option B — Run the three services one by one with their Dockerfiles

Use this to see exactly what Docker Compose does for you. You will build each image yourself, create a private network, and start the containers in the right order.

> ⚠️ **First stop the Compose version** if it is running (the names and ports would clash):
>
> ```bash
> docker compose down
> ```
>
> Expected output ends with: `✔ Container cardsplit-frontend  Removed` (and the backend and database too).

> 🪟 **PowerShell:** replace the `\` line continuations with a backtick `` ` `` , or write each command on a single line.

### Step 8.1 — Create a private network and a volume

```bash
docker network create cardsplit-manual-net
docker volume create cardsplit-manual-pgdata
```

Expected output:

```text
cardsplit-manual-net
cardsplit-manual-pgdata
```

The **network** lets the containers find each other by name. The **volume** keeps the database files safe.

### Step 8.2 — Database service

Build the image:

```bash
docker build -t cardsplit/database:1.0 ./database
```

Expected output ends with:

```text
 => => naming to docker.io/cardsplit/database:1.0
```

Start it (choose your own `POSTGRES_PASSWORD`):

```bash
docker run -d \
  --name cardsplit-database \
  --network cardsplit-manual-net \
  -e POSTGRES_DB=cardsplit \
  -e POSTGRES_USER=cardsplit \
  -e POSTGRES_PASSWORD=my-db-password \
  -v cardsplit-manual-pgdata:/var/lib/postgresql/data \
  cardsplit/database:1.0
```

Expected output: a long container ID, e.g. `a3f1c9d2e4b7...`

Wait until it is healthy (about 10–20 seconds):

```bash
docker ps --filter name=cardsplit-database --format "{{.Names}}  {{.Status}}"
```

Expected output:

```text
cardsplit-database  Up 18 seconds (healthy)
```

### Step 8.3 — Backend service

```bash
docker build -t cardsplit/backend:1.0 ./backend
```

```bash
docker run -d \
  --name cardsplit-backend \
  --network cardsplit-manual-net \
  -p 5000:5000 \
  -e DB_HOST=cardsplit-database \
  -e DB_PORT=5432 \
  -e DB_NAME=cardsplit \
  -e DB_USER=cardsplit \
  -e DB_PASSWORD=my-db-password \
  -e ADMIN_PASSWORD=my-admin-password \
  cardsplit/backend:1.0
```

> `DB_HOST` is the **name of the database container** — that is how the backend finds it on the private network. `DB_PASSWORD` must match the `POSTGRES_PASSWORD` above.

Check it:

```bash
docker logs cardsplit-backend
```

Expected output:

```text
[db] connected to cardsplit-database:5432/cardsplit
[api] CardSplit backend listening on port 5000
```

```bash
curl http://localhost:5000/api/health
```

Expected: `{"status":"ok","service":"cardsplit-backend","database":"connected",...}`

### Step 8.4 — Frontend service

```bash
docker build -t cardsplit/frontend:1.0 ./frontend
```

*(This one takes the longest the first time — it compiles the React app.)*

```bash
docker run -d \
  --name cardsplit-frontend \
  --network cardsplit-manual-net \
  -p 3000:80 \
  -e BACKEND_HOST=cardsplit-backend \
  -e BACKEND_PORT=5000 \
  cardsplit/frontend:1.0
```

Open **<http://localhost:3000>** 🎉

### Step 8.5 — Check all three

```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

Expected output:

```text
NAMES                STATUS                    PORTS
cardsplit-frontend   Up 20 seconds (healthy)   0.0.0.0:3000->80/tcp
cardsplit-backend    Up 1 minute (healthy)     0.0.0.0:5000->5000/tcp
cardsplit-database   Up 2 minutes (healthy)    5432/tcp
```

### Step 8.6 — Clean up Option B

```bash
docker rm -f cardsplit-frontend cardsplit-backend cardsplit-database
docker network rm cardsplit-manual-net
docker volume rm cardsplit-manual-pgdata      # ⚠️ deletes the database data
```

---

## 9. Option C — Develop without rebuilding images (optional)

For changing the code with instant reload. This needs **Node.js 22 or newer** installed on your computer ([nodejs.org](https://nodejs.org)).

Check it: `node --version` → expected `v22.x.x` or higher.

### Step 9.1 — Start only the database (and expose its port)

```bash
docker build -t cardsplit/database:1.0 ./database

docker run -d --name cardsplit-dev-db \
  -e POSTGRES_DB=cardsplit -e POSTGRES_USER=cardsplit -e POSTGRES_PASSWORD=dev-password \
  -p 5432:5432 \
  cardsplit/database:1.0
```

### Step 9.2 — Start the backend

Open a **new terminal**:

```bash
cd backend
npm install
```

**macOS / Linux:**

```bash
DB_HOST=localhost DB_PASSWORD=dev-password ADMIN_PASSWORD=dev-admin npm run dev
```

**Windows PowerShell:**

```powershell
$env:DB_HOST="localhost"; $env:DB_PASSWORD="dev-password"; $env:ADMIN_PASSWORD="dev-admin"; npm run dev
```

Expected output:

```text
[db] connected to localhost:5432/cardsplit
[api] CardSplit backend listening on port 5000
```

### Step 9.3 — Start the frontend

Open **another new terminal**:

```bash
cd frontend
npm install
npm run dev
```

Expected output (shortened):

```text
  VITE v8.x.x  ready in 900 ms

  ➜  Local:   http://localhost:3000/
```

Open **<http://localhost:3000>**. The Vite dev server automatically forwards `/api` to `http://localhost:5000`, and the page reloads whenever you save a file.

### Step 9.4 — Clean up

Press `Ctrl + C` in both terminals, then:

```bash
docker rm -f cardsplit-dev-db
```

---

## 10. Everyday commands

Run these from the project folder (Option A).

| What you want | Command |
|---|---|
| See what is running | `docker compose ps` |
| Watch all logs live (press `Ctrl+C` to stop watching) | `docker compose logs -f` |
| Watch one service | `docker compose logs -f backend` |
| Stop everything (**data is kept**) | `docker compose down` |
| Start again | `docker compose up -d` |
| Restart one service | `docker compose restart backend` |
| Rebuild after you changed code | `docker compose up -d --build` |
| Rebuild only the frontend | `docker compose up -d --build frontend` |
| Open a shell inside the backend | `docker compose exec backend sh` |
| Open the database console | `docker compose exec database psql -U cardsplit -d cardsplit` |
| See disk used by Docker | `docker system df` |

**Changed `ADMIN_PASSWORD` or a port in `.env`?** Apply it with:

```bash
docker compose up -d
```

---

## 11. Backup & restore your data

### Method 1 — From inside the app (easiest)

1. Open **Settings**.
2. Click **Export Backup (JSON)** — a file like `CardSplit_Backup_2026-10-27.json` downloads. This works even in Protected Mode.
3. To restore: unlock the app → **Settings** → **Import Backup (JSON)** → choose the file.

> Import **merges** the backup into the database: records with the same ID are updated and nothing is deleted.

### Method 2 — Full database dump (for administrators)

Create a backup file:

```bash
docker compose exec -T database pg_dump -U cardsplit cardsplit > cardsplit_backup.sql
```

No output is normal. Check the file is not empty:

```bash
ls -lh cardsplit_backup.sql
```

Expected: a file of several KB (even an empty database produces a small file).

Restore it into an **empty** database (after [resetting](#13-reset-everything)):

```bash
docker compose exec -T database psql -U cardsplit -d cardsplit < cardsplit_backup.sql
```

> 🪟 PowerShell does not support `<` redirection the same way. Use **Method 1**, or run the command from **Command Prompt (`cmd`)** or **Git Bash**.

---

## 12. Moving your data from the old version

If you used the **previous version** of CardSplit (the single app that stored data in the browser or in Supabase), you can bring your data across.

### Case 1 — Your data was in the browser (localStorage)

If you ran the old app locally at `http://localhost:3000`, this version uses the same address — so that browser may still hold your old data. (Browsers keep data separately per address, so this only works while `FRONTEND_PORT` is `3000`.)

1. Open **<http://localhost:3000>** in the **same browser** you used before.
2. Unlock the app and go to **Settings**.
3. If old data is found, an amber box appears: *"Data from the old version found in this browser"* with the counts of cards, people, bills and transactions.
4. Click **Copy to Database**.

Your data is now in PostgreSQL and available from any device.

### Case 2 — Your data was in Supabase (or another browser/computer)

1. Run the **old** version once more, go to **Settings → Export Backup (JSON)**, and save the file.
2. In the **new** version: unlock → **Settings → Import Backup (JSON)** → select that file.

The backup format is identical, so it imports directly (even backups with the old IDs such as `card-1`).

---

## 13. Reset everything

⚠️ **This permanently deletes all your cards, people, bills and transactions.** Export a backup first (see above) if you might need it.

```bash
docker compose down -v
```

Expected output:

```text
 ✔ Container cardsplit-frontend  Removed
 ✔ Container cardsplit-backend   Removed
 ✔ Container cardsplit-database  Removed
 ✔ Volume cardsplit_pgdata       Removed
 ✔ Network cardsplit_app-net     Removed
```

The `-v` flag removes the data volume. Start fresh with `docker compose up -d --build`; the database schema is recreated automatically.

You **must** do this reset if you change `DB_USER`, `DB_PASSWORD` or `DB_NAME` after the first start.

---

## 14. Troubleshooting

### ❌ `Cannot connect to the Docker daemon` / `error during connect`
Docker is not running. Start **Docker Desktop** and wait for "Engine running" (Windows/macOS), or `sudo systemctl start docker` (Linux).

### ❌ `permission denied ... /var/run/docker.sock` (Linux)
Your user is not in the `docker` group. Run `sudo usermod -aG docker $USER`, then **log out and back in**.

### ❌ `port is already allocated` / `address already in use`
Something else on your computer uses port 3000 or 5000.

1. Find it — macOS/Linux: `lsof -i :3000` · Windows: `netstat -ano | findstr :3000`
2. Either stop that program, **or** change `FRONTEND_PORT` / `BACKEND_PORT` in `.env`, then run `docker compose up -d`.

### ❌ The browser shows **"Backend Offline"**
1. Are all containers healthy? `docker compose ps`
2. Read the backend log: `docker compose logs backend`
3. Test directly: `curl http://localhost:3000/api/health`
4. Click **Refresh Data** in the top bar after fixing it.

### ❌ Backend log says `password authentication failed for user "cardsplit"`
The password in `.env` no longer matches the one the database was **first created with**. Either put the original `DB_PASSWORD` back, or reset the data volume ([step 13](#13-reset-everything)).

### ❌ Backend keeps printing `[db] not ready yet (n/30)`
The database is still starting, or failed to start. Check `docker compose logs database`. If it was just slow, it will connect by itself within a minute.

### ❌ `Incorrect password` when unlocking, but I'm sure it is right
The backend reads `ADMIN_PASSWORD` when it **starts**. After editing `.env`, run `docker compose up -d` so the container is recreated with the new value. After 10 wrong attempts you are blocked for 15 minutes (`Too many failed attempts`).

### ❌ Saving shows `Admin authorization required`
This happens if `ADMIN_PASSWORD` was changed (and the backend restarted) while the app was still unlocked in your browser. Click **Admin Unlocked** to lock, then **Protected Mode** to unlock again with the new password, and repeat the action.

### ❌ `A card with issuer "…" and name "…" already exists`
That is the duplicate protection working as intended. Use a different name, or edit the existing card.

### ❌ Build fails while downloading packages (`npm install` errors, network timeouts)
Docker needs internet access during the first build. Check your connection, VPN or proxy and run `docker compose up -d --build` again — Docker resumes from the cached steps.

### ❌ I edited the code but nothing changed
Containers run the **built** image. Rebuild: `docker compose up -d --build`. (Or use [Option C](#9-option-c--develop-without-rebuilding-images-optional) for live reload.)

### ❌ The page is blank or shows old content after an update
Hard-refresh the browser: `Ctrl + Shift + R` (Windows/Linux) or `Cmd + Shift + R` (macOS).

### 🔎 Still stuck?
Collect the logs and look for the first line that says `error`:

```bash
docker compose logs --tail=100
```

---

## 15. Security checklist

Before sharing this with other people or putting it on a server:

- [ ] Changed `ADMIN_PASSWORD` from the default
- [ ] Changed `DB_PASSWORD` from the default (before the **first** start, or reset the volume)
- [ ] `.env` is **not** committed to Git (it is already listed in `.gitignore`)
- [ ] The database port is **not** published (it is private by default — leave the `ports:` lines under `database` commented out)
- [ ] If reachable from the internet, it sits behind an **HTTPS** reverse proxy (Caddy, Traefik, Nginx, a cloud load balancer…)
- [ ] You keep regular backups ([step 11](#11-backup--restore-your-data))

---

✅ **That's it!** Return to the [README](../README.md) for the project overview and API reference.
