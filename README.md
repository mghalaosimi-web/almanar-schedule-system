# Manar Schedule System

A comprehensive university schedule management system built with React, Node.js, Express, and PostgreSQL.

## 🚀 Features

- **Student Management**: Register, verify, and manage student profiles
- **Schedule Management**: Create, view, and override class schedules
- **Role-Based Access Control**: Admin and Super Admin roles with different permissions
- **Notifications**: Automated daily schedule summaries via cron jobs
- **Authentication**: JWT-based authentication with email/phone verification
- **Real-time Updates**: Schedule overrides with instant notifications

## 📋 Prerequisites

- Node.js 16+ 
- PostgreSQL 12+
- npm or yarn

## 🛠️ Installation

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/mghalaosimi-web/manar-schedule-system.git
   cd manar-schedule-system
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```
   *(This automatically installs dependencies for both backend and frontend, and generates the Prisma client.)*

3. **Configure environment variables**
   ```bash
   cd backend && cp .env.example .env
   # Edit backend/.env with your database URL and JWT secret
   ```

4. **Set up the database**
   ```bash
   cd backend && npx prisma migrate dev --name init && npx prisma db seed
   ```

5. **Start development servers**
   ```bash
   npm run dev
   ```

## 🚀 Deployment on Render

### Step 1: Push to GitHub
Make sure your code is pushed to GitHub.

### Step 2: Create Render Account
Go to [render.com](https://render.com) and create an account.

### Step 3: Create PostgreSQL Database
1. Click "New" → "PostgreSQL"
2. Give it a name (e.g., `manar-schedule-db`)
3. Choose the plan (Free or Starter recommended)
4. Create the database
5. Copy the connection string

### Step 4: Deploy Backend Service
1. Click "New" → "Web Service"
2. Connect your GitHub repository
3. Configure as follows:
   - **Name**: `manar-schedule-system`
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build:frontend && cd backend && npx prisma generate && npx prisma migrate deploy`
   - **Start Command**: `node backend/src/server.js`

4. **Add Environment Variables**:
   ```
   DATABASE_URL=<your_postgresql_connection_string>
   JWT_SECRET=<generate_a_secure_random_string>
   NODE_ENV=production
   ```

5. Create the service

### Step 5: Run Database Migrations
After deployment, run migrations in Render:
1. Go to your service in Render
2. Click "Shell" 
3. Run: `cd backend && npx prisma migrate deploy`
4. Run: `cd backend && node prisma/seed.js` (to seed initial data)

### Step 6: Test the Deployment
1. Visit your service URL
2. Test the health check: `GET /api/health`
3. Test login functionality

## 🔐 Environment Variables

```env
# Required
DATABASE_URL=postgresql://user:password@host:5432/dbname
JWT_SECRET=your_secure_jwt_secret_minimum_32_characters

# Optional
PORT=5000
NODE_ENV=production
```

## 📁 Project Structure

```
.
├── backend/
│   ├── src/
│   │   ├── server.js          # Main Express server
│   │   ├── middleware/
│   │   └── ...
│   ├── prisma/
│   │   ├── schema.prisma      # Database schema
│   │   └── seed.js            # Seed script
│   ├── package.json           # Backend dependencies
│   └── .env.example
├── frontend/
│   ├── src/
│   ├── package.json           # Frontend dependencies
│   └── vite.config.js
├── package.json               # Root orchestrator
└── build.js                   # Build orchestrator
```

## 🔑 API Endpoints

### Authentication
- `POST /api/auth/login` - Student/Admin login
- `POST /api/auth/register` - Student registration
- `POST /api/auth/verify` - Email/Phone verification
- `GET /api/auth/captcha` - Get CAPTCHA challenge

### Schedules
- `GET /api/schedules` - Get all schedules
- `POST /api/schedules` - Create new schedule (Admin)
- `POST /api/schedules/override` - Override schedule (Admin)

### Admin
- `GET /api/students` - Get all students
- `GET /api/admin/metrics` - Get system metrics
- `GET /api/admin/logs` - Get notification logs
- `POST /api/broadcasts` - Send broadcast message

## 🛠️ Troubleshooting

### Database Connection Issues
- Verify DATABASE_URL is correct
- Check PostgreSQL is running
- Ensure firewall allows connections

### Build Failures
- Check Node.js version (16+)
- Clear node_modules: `rm -rf node_modules && npm install`
- Verify all environment variables are set

### Migration Errors
- Reset database: `npx prisma migrate reset`
- Check schema.prisma for syntax errors
- Ensure PostgreSQL user has proper permissions

## 📝 License

ISC License - See LICENSE file for details

## 👥 Support

For issues or questions, please open a GitHub issue.
