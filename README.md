<p align="center">
  <a href="https://www.medusajs.com">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://user-images.githubusercontent.com/59018053/229103275-b5e482bb-4601-46e6-8142-244f531cebdb.svg">
      <source media="(prefers-color-scheme: light)" srcset="https://user-images.githubusercontent.com/59018053/229103726-e5b529a3-9b3f-4970-8a1f-c6af37f087bf.svg">
      <img alt="Medusa logo" src="https://user-images.githubusercontent.com/59018053/229103726-e5b529a3-9b3f-4970-8a1f-c6af37f087bf.svg">
    </picture>
  </a>
</p>

<h1 align="center">My Medusa Store (v2)</h1>

<h4 align="center">
  <a href="https://docs.medusajs.com">Documentation</a> |
  <a href="https://www.medusajs.com">Website</a>
</h4>

<p align="center">
  Building blocks for digital commerce, optimized for local development.
</p>

---

## 🛠 Tech Stack

| Layer             | Technology                          |
| ----------------- | ----------------------------------- |
| Framework         | Medusa v2                           |
| Database          | PostgreSQL 16 (Docker)              |
| Cache & Event Bus | Redis (Docker)                      |
| Runtime           | Node.js 20+                         |
| Infrastructure    | Docker Desktop (via Docker Compose) |

---

## 📋 Prerequisites

Before starting, ensure you have the following installed:

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (must be running)
- [Node.js v20+](https://nodejs.org/)
- [npm](https://www.npmjs.com/) or [pnpm](https://pnpm.io/)

---

## 🚀 Daily Startup Routine

Follow these steps every time you start your computer:

### 1. Start Infrastructure

```bash
docker-compose up -d
```

Starts PostgreSQL and Redis in detached mode. Docker manages ports `5432` and `6379` to avoid conflicts with Windows services.

### 2. Start Medusa Server

```bash
npm run dev
```

Wait until the terminal shows: `✔ Server is ready on port: 9000`

### 3. Access the Dashboard

| Service        | URL                         |
| -------------- | --------------------------- |
| Admin Panel    | http://localhost:9000/app   |
| Storefront API | http://localhost:9000/store |

---

## ⚙️ Initial Setup (First-time only)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Environment

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/medusa_local
REDIS_URL=redis://localhost:6379
```

### 3. Initialize Database

```bash
npx medusa db:migrate
```

### 4. Create Admin User

```bash
npx medusa user -e admin@me.com -p password123
```

### 5. (Optional) Seed Demo Data

```bash
npx medusa db:seed
```

---

## 🛡 Infrastructure Management

> `docker-compose.yml` uses **Named Volumes** instead of local folders to prevent infinite restart loops on Windows.

| Command                           | Description                |
| --------------------------------- | -------------------------- |
| `docker-compose stop`             | Stop databases (keep data) |
| `docker-compose down`             | Stop and remove containers |
| `docker-compose down -v`          | Wipe all data and reset    |
| `docker-compose logs -f postgres` | View PostgreSQL logs       |

---

## 💾 Database Backups

**Create a backup:**

```bash
docker exec medusa-local-db pg_dump -U postgres medusa_local > medusa_backup.sql
```

**Restore from backup:**

```powershell
Get-Content medusa_backup.sql | docker exec -i medusa-local-db psql -U postgres medusa_local
```

---

## 💡 Windows Development Tips

> **Infinite restart loops** — Do **NOT** map database volumes to folders inside the project root (e.g. `./postgres_data`). This triggers Medusa's file-watcher. Always use Named Volumes as defined in `docker-compose.yml`.

> **Port conflicts** — If Docker fails to start, open `services.msc` (Win+R) and make sure the Windows `PostgreSQL` service is **Stopped**.

---

## 📖 Official Resources

- [Medusa v2 Documentation](https://docs.medusajs.com)
- [Medusa GitHub](https://github.com/medusajs/medusa)
