# MySQL Backend Setup

This backend now uses MySQL through the `mysql2` package and is compatible with XAMPP MySQL, phpMyAdmin, and `localhost:3306`.

## 1. Start MySQL In XAMPP

1. Open XAMPP Control Panel.
2. Start the MySQL service.
3. Open phpMyAdmin at:

```text
http://localhost/phpmyadmin
```

## 2. Create The Database

In phpMyAdmin:

1. Click `New`.
2. Enter database name:

```text
collegeDB
```

3. Select collation:

```text
utf8mb4_unicode_ci
```

4. Click `Create`.

You can also create it from SQL:

```sql
CREATE DATABASE collegeDB CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

## 3. Import Schema And Seed Data

Option A: Using phpMyAdmin

1. Select the `collegeDB` database.
2. Open the `Import` tab.
3. Import `db/schema.sql`.
4. Import `db/seed.sql`.

Option B: Using backend script

```bash
cd backend
npm run db:migrate
```

## 4. Configure Environment Variables

Create or update `backend/.env`:

```env
PORT=4000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=collegeDB
JWT_SECRET=local-development-secret-change-me
CLIENT_ORIGINS=http://localhost:5173
```

For a default XAMPP MySQL installation, the user is usually `root` and the password is usually empty.

## 5. Install Backend Dependencies

```bash
cd backend
npm install
```

## 6. Run Backend

Development mode:

```bash
npm run dev
```

Production/start mode:

```bash
npm start
```

Backend URL:

```text
http://localhost:4000
```

Health check:

```text
http://localhost:4000/api/health
```
