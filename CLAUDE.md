# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **OnTicket**, a multi-tenant nightclub management application built with React + TypeScript + Vite and Supabase. It implements a secure admin authentication system where each nightclub has its own dedicated admin account.

## Tech Stack & Key Dependencies

- **Frontend**: React 19, TypeScript, Vite
- **UI Components**: shadcn/ui (Radix UI + Tailwind CSS)
- **Backend/Database**: Supabase (PostgreSQL + Auth + RLS)
- **Routing**: React Router DOM v7
- **Forms**: React Hook Form + Zod validation
- **State Management**: React Context (AuthContext)
- **Styling**: Tailwind CSS v4

## Development Commands

```bash
# Development server with hot reload
npm run dev

# Build for production
npm run build

# Build TypeScript only (validation)
tsc -b

# Lint code
npm run lint

# Preview production build
npm run preview
```

## Architecture Overview

### Authentication & Multi-tenancy
- **1:1 relationship**: Each admin belongs to exactly one club
- **Row Level Security (RLS)**: Enforced at database level for data isolation
- **Auth flow**: Supabase Auth → AuthContext → ProtectedRoute → Dashboard
- **Access control**: Only active admins can access their club's data

### Database Schema
- **clubs**: Main entity with club details and status
- **admins**: Links auth.users to clubs (1:1 relationship)
- **accounts**: Financial accounts per club (cash, wallet, bank, other)
- **account_transactions**: Transaction history for balance calculations
- **Views**: `accounts_with_balance` calculates current balances

### Key Paths & Aliases
- `@/*` → `./src/*` (configured in tsconfig.json & vite.config.ts)
- `@/components` → UI components
- `@/lib` → Utilities (supabase, auth, utils)
- `@/hooks` → Custom React hooks
- `@/pages` → Route components
- `@/types` → TypeScript type definitions

### Environment Variables Required
- `VITE_SUPABASE_URL`: Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Supabase anon public key

## Code Patterns & Conventions

### Component Structure
- Uses shadcn/ui components from `@/components/ui`
- Custom components in `@/components` with feature-based organization
- TypeScript interfaces defined in `@/types`
- Hooks in `@/hooks` for reusable logic

### Authentication Flow
1. **AuthProvider** wraps entire app with authentication state
2. **ProtectedRoute** checks authentication + admin status
3. **useAuth** hook provides auth state and methods
4. **Dashboard** requires `requireAdmin={true}` prop

### Database Interactions
- Supabase client configured in `@/lib/supabase.ts`
- Auth service in `@/lib/auth.ts`
- Type-safe database queries using TypeScript interfaces from `@/types/database.ts`

### File Organization
```
src/
├── components/
│   ├── ui/          # shadcn/ui components
│   └── auth/        # Authentication components
├── hooks/           # Custom React hooks
├── lib/            # Utilities and services
├── pages/          # Route components
├── types/          # TypeScript definitions
├── context/        # React context providers
└── supabaseDoc/    # SQL schema files
```

## Security Considerations

- **No public registration**: Admin accounts must be created via service role
- **RLS policies**: Data isolation enforced at database level
- **Environment variables**: Never commit secrets to repository
- **Auth state**: Centralized in AuthContext with proper loading states