# DevForge[x] — Referral Management Platform (Backend)

DevForge[x] is a multi-tenant referral management platform built to streamline and secure vendor-submitted referrals. This directory contains the NestJS REST API backend service.

---

## Tech Stack

| Layer | Technology | Description |
|-------|------------|-------------|
| **Backend** | NestJS | Robust REST API structure with modules, guards, and decorators |
| **Database** | MongoDB | High-performance document database for flexible record storage |
| **ORM** | Prisma ORM | Object-Relational Mapper connecting NestJS to MongoDB |
| **Auth** | Supabase Auth | Token verification and identity sync logic |
| **Email** | Mail Service (Resend) | Automated vendor onboarding & credential delivery system |
| **Validation** | class-validator | Server-side validation |

---

## Features

- 🔐 **Role-Based Access Control (RBAC)**: Backend endpoints protected using custom NestJS `AuthGuard` and `RolesGuard` (`admin` vs. `vendor`).
- ✉️ **Automated Vendor Onboarding**: Admins can register new vendors. The backend automatically provisions a Supabase Auth user, generates a secure random password, and sends login credentials to the vendor using the Resend email service.
- 📊 **Metric Dashboards**: Scoped data queries to return system-wide statistics for admins, and workspace-scoped statistics for vendors.
- 📋 **Referral Management**: Secure CRUD API endpoints for managing referrals.

---

## Project Structure

```
backend/
├── prisma/
│   └── schema.prisma       # Prisma datasource & model models
├── src/
│   ├── auth/               # JWT token validation filters
│   ├── users/              # Vendor management endpoints
│   ├── companies/          # Company workspace endpoints
│   ├── referrals/          # Referral submission endpoints
│   ├── mail/               # Modular email engines (Resend / Nodemailer)
│   └── common/             # Auth/Roles guards and metadata decorators
└── scripts/
    └── add-admin.ts        # Bootstrap CLI tool for admins
```

---

## Database Schema (Prisma with MongoDB)

The database schema is structured to run efficiently on MongoDB using `@db.ObjectId` mappings:

- **User**: Core profile containing name, email, role, and workspace selections (`defaultCompanyId` and `lastUsedCompanyId`).
- **Company**: Workspace identity details including name, logo, accent color, and active status.
- **CompanyVendor**: Join model mapping vendors to companies.
- **Referral**: Scoped referral submissions containing product info, contacts, links, and workspace associations.

Refer to [schema.prisma](file:///Users/hitesh/Project/devforge-hub/backend/prisma/schema.prisma) for exact fields.

---

## Environment Setup

### 1. File Configuration

Copy environment template file:
```bash
cp .env.example .env
```

### 2. Variable Parameters

#### **.env**
```env
PORT=3001
CORS_ORIGIN=http://localhost:3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# MongoDB Connection String (Atlas or Local)
DATABASE_URL="mongodb+srv://[username]:[password]@[cluster]/[database]?retryWrites=true&w=majority"

# Mail Settings
MAIL_PROVIDER=resend
RESEND_API_KEY=re_your_api_key
MAIL_FROM=DevForge[x] <noreply@yourdomain.com>
FRONTEND_URL=http://localhost:3000
```

---

## Installation & Launch

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Sync MongoDB Schema
Use Prisma CLI to push collections and indexes to your MongoDB database:
```bash
npx prisma generate
npx prisma db push
```

### Step 3: Seed Admin User
Create your primary admin account using the CLI script:
```bash
npm run add-admin -- --email admin@example.com --password your-password --name "Admin User"
```

### Step 4: Run Development Backend
Start the NestJS backend API server (runs on http://localhost:3001):
```bash
npm run start:dev
```

---

## Package Scripts Reference

| Script Command | Description |
|----------------|-------------|
| `npm run build` | Compile backend code |
| `npm run start` | Start production build |
| `npm run start:dev` | Launch NestJS dev server with watch mode |
| `npm run prisma:generate` | Rebuild Prisma client files |
| `npm run prisma:push` | Push schema updates and index configs to MongoDB |
| `npm run add-admin` | Bootstrap CLI to create admin accounts |
