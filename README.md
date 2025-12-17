# NestJS Backend Template

Production-ready NestJS backend template with authentication, user management, and layered architecture.

## Quick Start

```bash
# Install dependencies
npm install

# Start PostgreSQL and Redis
docker-compose up -d

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Seed superadmin
npm run prisma:seed

# Start development server
npm run start:dev
```

## Production Features

### Security

| Feature | Description |
|---------|-------------|
| **Helmet.js** | HTTP security headers (CSP, XSS protection, etc.) |
| **Rate Limiting** | Global: 100 req/min, Auth endpoints: 3-15 req/min |
| **JWT Authentication** | Access tokens (15min) + Refresh tokens (7d) |
| **Password Hashing** | Bcrypt with salt rounds |
| **CORS** | Configurable whitelist |
| **Soft Deletes** | Data preservation for audit trails |
| **User Caching** | Redis cache for JWT validation (5 min TTL) |

### Rate Limiting by Endpoint

| Endpoint | Limit | Reason |
|----------|-------|--------|
| Global | 100/min | General protection |
| `/auth/signin` | 15/min | Brute force protection |
| `/auth/signup` | 5/min | Spam prevention |
| `/auth/forgot-password` | 3/min | Email spam prevention |
| `/auth/resend-verification` | 3/min | Email spam prevention |
| `/auth/refresh` | 30/min | Token refresh |
| `/auth/reset-password` | 5/min | Reset attempts |
| `/auth/verify-email` | 5/min | Verification attempts |

### Observability

| Feature | Description |
|---------|-------------|
| **Request Correlation IDs** | UUID attached to every request for tracing |
| **Request/Response Logging** | Opt-in HTTP logging with timing |
| **Structured Error Responses** | Consistent error format with codes |
| **Health Checks** | Liveness and readiness probes |

### Health Check Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/health` | Full health check (DB + Redis) |
| `GET /api/health/live` | Liveness probe (is app running?) |
| `GET /api/health/ready` | Readiness probe (can serve traffic?) |

### Request Correlation IDs

Every request gets a unique correlation ID for tracing:

```
# Request header (auto-generated or passed)
x-correlation-id: 550e8400-e29b-41d4-a716-446655440000

# Response header (returned)
x-correlation-id: 550e8400-e29b-41d4-a716-446655440000

# Logs
[550e8400-e29b-41d4-a716-446655440000] POST /api/auth/signin - 200 - 45ms
```

Pass your own correlation ID in the request header to trace across services.

### Request Logging

Enable/disable via environment variable:

```bash
ENABLE_REQUEST_LOGGING=true   # Enable (default)
ENABLE_REQUEST_LOGGING=false  # Disable
```

Log output:
```
→ [correlation-id] POST /api/auth/signin - 192.168.1.1 - Mozilla/5.0...
← [correlation-id] POST /api/auth/signin - 200 - 45ms
```

### Response Format

All responses are wrapped consistently:

**Success (single resource):**
```json
{
  "data": {
    "uid": "...",
    "email": "..."
  }
}
```

**Success (paginated):**
```json
{
  "data": [...],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "totalPages": 10,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

**Error:**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      { "field": "email", "message": "email must be valid" }
    ],
    "timestamp": "2025-01-15T10:30:00.000Z",
    "path": "/api/auth/signup",
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**Error Codes:**

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `BAD_REQUEST` | 400 | Invalid request |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

### Enum Values

| Enum | Values | Usage |
|------|--------|-------|
| `Role` | `superadmin` \| `admin` \| `user` | User permission level |

### Graceful Shutdown

The application handles shutdown signals properly:

```
SIGTERM received → Stop accepting requests → Complete in-flight requests → Close DB/Redis → Exit
```

Triggered by: Kubernetes pod termination, Docker stop, Ctrl+C, process managers

### Database Connection Pooling

Prisma connection pooling via URL parameters:

```
DATABASE_URL=postgresql://...?connection_limit=10&pool_timeout=30
```

| Parameter | Description | Default |
|-----------|-------------|---------|
| `connection_limit` | Max connections in pool | 10 |
| `pool_timeout` | Wait time for connection (seconds) | 30 |

### Environment Validation

All environment variables are validated on startup using Zod:

```
Environment validation failed:
  - JWT_SECRET: JWT_SECRET must be at least 32 characters
  - DATABASE_URL: DATABASE_URL is required
```

Application fails fast if configuration is invalid.

### Email Service (AWS SES)

Transactional emails are sent via Amazon Simple Email Service (SES).

**Features:**
- Email verification on signup
- Password reset emails
- Customizable HTML templates
- Plain text fallback support

**Configuration:**
```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
MAIL_FROM=noreply@yourdomain.com
```

**Usage in services:**
```typescript
// Inject MailService (globally available)
constructor(private mailService: MailService) {}

// Send custom email
await this.mailService.sendMail(
  'user@example.com',
  'Subject',
  '<html>...</html>',
  'Plain text fallback'
);

// Built-in methods
await this.mailService.sendEmailVerification(email, token);
await this.mailService.sendPasswordReset(email, token);
```

### File Storage (Cloudflare R2)

File uploads are stored in Cloudflare R2 (S3-compatible storage).

**Features:**
- Direct file upload (via server)
- Presigned URLs for client-side uploads
- Presigned URLs for secure downloads
- Configurable file size limits
- MIME type validation

**Configuration:**
```bash
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET_NAME=your-bucket
R2_PUBLIC_URL=https://your-bucket.your-domain.com

MAX_FILE_SIZE=10485760  # 10MB
ALLOWED_MIME_TYPES=image/jpeg,image/png,image/gif,image/webp,application/pdf
```

**API Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /upload | Direct file upload |
| POST | /upload/presigned/upload | Get presigned URL for client upload |
| POST | /upload/presigned/download | Get presigned URL for download |
| DELETE | /upload/:key | Delete file by storage key |

**Usage in services:**
```typescript
// Inject StorageService (globally available)
constructor(private storageService: StorageService) {}

// Upload file
const result = await this.storageService.upload(key, buffer, contentType);
// Returns: { key, url, size, contentType }

// Get presigned upload URL (for client-side uploads)
const uploadUrl = await this.storageService.getPresignedUploadUrl(key, contentType, { expiresIn: 3600 });

// Get presigned download URL
const downloadUrl = await this.storageService.getPresignedDownloadUrl(key, { expiresIn: 3600 });

// Delete file
await this.storageService.delete(key);

// Generate unique key
const key = this.storageService.generateKey('avatars', 'photo.jpg');
// Returns: avatars/1702847123456-photo.jpg
```

### User Caching (Redis)

User data is cached in Redis to eliminate database queries on every authenticated request.

**How it works:**
```
Authenticated Request
    ↓
JWT Strategy validates token
    ↓
Check Redis cache for user (key: user:{id})
    ↓
Cache HIT → Return cached user (sub-ms)
Cache MISS → Query DB → Cache result → Return user
```

**Cache Configuration:**
| Setting | Value |
|---------|-------|
| Key format | `user:{userId}` |
| TTL | 5 minutes |
| Cached fields | id, uid, email, fullName, role, refreshToken, deletedAt |

**Cache Invalidation:**

Cache is automatically invalidated when user data changes:

| Operation | Invalidates Cache |
|-----------|-------------------|
| User update (profile) | Yes |
| User update (admin) | Yes |
| Password change | Yes |
| User delete | Yes |
| Logout | Yes |
| Token refresh | Yes |

**Performance Impact:**
- Before: Every authenticated request = 1 DB query
- After: Most requests = 1 Redis lookup (~0.5ms vs ~5-20ms)

**Adding Cache to Other Entities:**

Follow this pattern for caching other frequently-accessed data:

```typescript
// 1. Create cache service (src/infra/redis/entity-cache.service.ts)
@Injectable()
export class EntityCacheService {
  private readonly PREFIX = 'entity';
  private readonly TTL_SECONDS = 300;

  constructor(private redis: RedisService) {}

  async get(id: number): Promise<CachedEntity | null> {
    const cached = await this.redis.get(`${this.PREFIX}:${id}`);
    return cached ? JSON.parse(cached) : null;
  }

  async set(entity: Entity): Promise<void> {
    await this.redis.set(
      `${this.PREFIX}:${entity.id}`,
      JSON.stringify(entity),
      this.TTL_SECONDS
    );
  }

  async invalidate(id: number): Promise<void> {
    await this.redis.del(`${this.PREFIX}:${id}`);
  }
}

// 2. Use in service
const cached = await this.entityCache.get(id);
if (!cached) {
  const entity = await this.prisma.entity.findFirst({ ... });
  await this.entityCache.set(entity);
}

// 3. Invalidate on mutations
await this.prisma.entity.update({ ... });
await this.entityCache.invalidate(id);
```

---

## Architecture Overview

```
src/
├── main.ts                     # Application entry point
├── app.module.ts               # Root module
├── config/                     # Configuration & validation
│   └── env.config.ts           # Zod schema for env vars
├── core/                       # Cross-cutting concerns
│   ├── decorators/             # Custom decorators
│   ├── guards/                 # Auth guards
│   ├── filters/                # Exception filters
│   ├── interceptors/           # Request/response interceptors
│   └── middleware/             # HTTP middleware
├── infra/                      # Infrastructure services
│   ├── prisma/                 # Database connection
│   ├── logger/                 # Pino logger
│   ├── redis/                  # Redis cache
│   ├── mail/                   # Email service (AWS SES)
│   └── storage/                # File storage (Cloudflare R2)
├── common/                     # Shared utilities
│   ├── dto/                    # Common DTOs (pagination)
│   ├── types/                  # Shared types
│   └── utils/                  # Utility functions
└── modules/                    # Feature modules
    ├── auth/                   # Authentication
    ├── users/                  # User management
    ├── upload/                 # File upload
    └── health/                 # Health checks
```

## Module Structure Pattern

Each feature module follows this layered architecture:

```
{module}/
├── {module}.module.ts          # NestJS module definition
├── {module}.controller.ts      # HTTP endpoints (presentation layer)
├── {module}.service.ts         # Business logic (service layer)
├── dto/
│   ├── request/                # Input DTOs with validation
│   └── response/               # Output DTOs with transformation
├── services/                   # Sub-services for complex operations
└── index.ts                    # Barrel exports
```

## Database Schema

### User Model

| Field | Type | Description |
|-------|------|-------------|
| id | Int | Auto-increment primary key (internal) |
| uid | UUID | Public identifier for API |
| email | String | Unique email address |
| password | String | Bcrypt hashed password |
| fullName | String | User's full name |
| role | Enum | superadmin, admin, user |
| emailVerified | Boolean | Email verification status |
| emailVerificationToken | String? | Verification token |
| emailVerificationExpires | DateTime? | Token expiry |
| passwordResetToken | String? | Reset token |
| passwordResetExpires | DateTime? | Token expiry |
| refreshToken | String? | Hashed refresh token |
| createdAt | DateTime | Creation timestamp |
| updatedAt | DateTime | Last update timestamp |
| deletedAt | DateTime? | Soft delete timestamp |

## API Endpoints

### Auth Module (`/api/auth`)

| Method | Endpoint | Auth | Rate Limit | Description |
|--------|----------|------|------------|-------------|
| POST | /signup | Public | 5/min | Register new user |
| POST | /signin | Public | 15/min | Login with credentials |
| POST | /logout | JWT | - | Logout current session |
| POST | /refresh | Public | 30/min | Refresh access token |
| POST | /forgot-password | Public | 3/min | Request password reset |
| POST | /reset-password | Public | 5/min | Reset password with token |
| POST | /verify-email | Public | 5/min | Verify email with token |
| POST | /resend-verification | Public | 3/min | Resend verification email |

### Users Module (`/api/users`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | / | Admin | List all users (paginated) |
| GET | /me | JWT | Get current user profile |
| PATCH | /me | JWT | Update current user profile |
| PATCH | /me/password | JWT | Change password |
| GET | /:uid | Admin | Get user by UID |
| PATCH | /:uid | Admin | Update user (admin) |
| DELETE | /:uid | Admin | Soft delete user |

### Upload Module (`/api/upload`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | / | JWT | Upload file directly |
| POST | /presigned/upload | JWT | Get presigned upload URL |
| POST | /presigned/download | JWT | Get presigned download URL |
| DELETE | /:key | JWT | Delete file by key |

### Health Module (`/api/health`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | / | Public | Full health check |
| GET | /live | Public | Liveness probe |
| GET | /ready | Public | Readiness probe |

## Authentication Flow

1. JWT tokens stored in Authorization header as Bearer token
2. Access token expires in 15 minutes (configurable)
3. Refresh token expires in 7 days (configurable)
4. Refresh tokens are bcrypt hashed before storage
5. Logout invalidates session by nulling refresh token
6. JwtAuthGuard is applied globally, use @Public() for public routes

## Adding New Modules

1. Create module directory: `src/modules/{module-name}/`

2. Create files following the structure:
   - `{module}.module.ts`
   - `{module}.controller.ts`
   - `{module}.service.ts`
   - `dto/request/*.dto.ts`
   - `dto/response/*.response.ts`
   - `index.ts`

3. Register in `app.module.ts`:
   ```typescript
   imports: [
     // ... existing modules
     NewModule,
   ],
   ```

4. Add Prisma model in `prisma/schema.prisma`

5. Run migration: `npm run prisma:migrate`

## DTOs and Validation

Request DTOs use class-validator decorators:
```typescript
export class CreateSomethingDto {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;
}
```

Response DTOs use static factory methods:
```typescript
export class SomethingResponse {
  @ApiProperty()
  uid: string;

  @ApiProperty()
  name: string;

  static fromEntity(entity: Something): SomethingResponse {
    return {
      uid: entity.uid,
      name: entity.name,
    };
  }
}
```

## Guards and Decorators

### @Public()
Marks a route as public, bypassing JWT authentication:
```typescript
@Public()
@Get('public-data')
getPublicData() {}
```

### @CurrentUser()
Extracts authenticated user from request:
```typescript
@Get('me')
getMe(@CurrentUser() user: CurrentUserPayload) {}
```

### @Roles()
Restricts access to specific roles:
```typescript
@UseGuards(RolesGuard)
@Roles(Role.superadmin, Role.admin)
@Get('admin-only')
adminOnly() {}
```

### @SkipResponseWrapper()
Skips the response wrapper for specific endpoints:
```typescript
@SkipResponseWrapper()
@Get('raw-data')
getRawData() {}
```

## Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| NODE_ENV | Environment mode | development | No |
| PORT | Server port | 4000 | No |
| DATABASE_URL | PostgreSQL connection string | - | Yes |
| JWT_SECRET | JWT signing secret (min 32 chars) | - | Yes |
| JWT_ACCESS_EXPIRES_IN | Access token TTL | 15m | No |
| JWT_REFRESH_EXPIRES_IN | Refresh token TTL | 7d | No |
| REDIS_HOST | Redis host | localhost | No |
| REDIS_PORT | Redis port | 6379 | No |
| CORS_WHITELIST | Allowed origins (comma-separated) | - | No |
| SWAGGER_USERNAME | Swagger basic auth username | admin | No |
| SWAGGER_PASSWORD | Swagger basic auth password (min 8 chars) | - | Yes |
| AWS_REGION | AWS region for SES | us-east-1 | No |
| AWS_ACCESS_KEY_ID | AWS access key ID | - | No |
| AWS_SECRET_ACCESS_KEY | AWS secret access key | - | No |
| MAIL_FROM | Email from address | - | No |
| R2_ACCOUNT_ID | Cloudflare account ID | - | No |
| R2_ACCESS_KEY_ID | R2 access key ID | - | No |
| R2_SECRET_ACCESS_KEY | R2 secret access key | - | No |
| R2_BUCKET_NAME | R2 bucket name | - | No |
| R2_PUBLIC_URL | R2 public URL | - | No |
| MAX_FILE_SIZE | Max upload size (bytes) | 10485760 | No |
| ALLOWED_MIME_TYPES | Allowed MIME types | image/jpeg,... | No |
| FRONTEND_URL | Frontend URL | - | No |
| PASSWORD_RESET_URL | Password reset page URL | - | No |
| EMAIL_VERIFICATION_URL | Email verification page URL | - | No |
| SUPERADMIN_EMAIL | Initial superadmin email | - | No |
| SUPERADMIN_PASSWORD | Initial superadmin password | - | No |
| SUPERADMIN_FULL_NAME | Initial superadmin name | - | No |
| ENABLE_REQUEST_LOGGING | Enable HTTP request logging | true | No |

## Path Aliases

TypeScript path aliases for cleaner imports:

| Alias | Path |
|-------|------|
| @/* | src/* |
| @config | src/config |
| @modules | src/modules |
| @infra/* | src/infra/* |
| @common/* | src/common/* |
| @core/* | src/core/* |

## Code Style Rules

1. No comments in code - document in this README
2. Use barrel exports (index.ts) for all directories
3. Use static factory methods for response DTOs
4. Use soft deletes (deletedAt field) for user data
5. Use UUID for public identifiers, auto-increment for internal IDs
6. All endpoints return consistent response structures
7. Use validation pipes with whitelist and transform options

## File Naming Conventions

| Type | Pattern | Example |
|------|---------|---------|
| Module | `{entity}.module.ts` | `users.module.ts` |
| Controller | `{entity}.controller.ts` | `users.controller.ts` |
| Service | `{entity}.service.ts` | `users.service.ts` |
| Create DTO | `create-{entity}.dto.ts` | `create-user.dto.ts` |
| Update DTO | `update-{entity}.dto.ts` | `update-user.dto.ts` |
| Response DTO | `{entity}.response.ts` | `user.response.ts` |
| Guard | `{name}.guard.ts` | `jwt-auth.guard.ts` |
| Interceptor | `{name}.interceptor.ts` | `response-wrapper.interceptor.ts` |
| Filter | `{name}.filter.ts` | `http-exception.filter.ts` |
| Middleware | `{name}.middleware.ts` | `correlation-id.middleware.ts` |
| Strategy | `{name}.strategy.ts` | `jwt.strategy.ts` |
| Unit Test | `{file}.spec.ts` | `users.service.spec.ts` |
| E2E Test | `{feature}.e2e-spec.ts` | `auth.e2e-spec.ts` |

## Test File Locations

```
src/
├── modules/
│   ├── auth/
│   │   ├── auth.service.ts
│   │   └── auth.service.spec.ts      # Unit test (co-located)
│   └── users/
│       ├── users.service.ts
│       └── users.service.spec.ts     # Unit test (co-located)
test/
├── auth.e2e-spec.ts                  # E2E test
├── users.e2e-spec.ts                 # E2E test
└── jest-e2e.json                     # E2E config
```

**Test Commands:**
```bash
npm run test              # Run unit tests
npm run test:watch        # Watch mode
npm run test:cov          # Coverage report
npm run test:e2e          # E2E tests
```

## Database Naming Conventions

Code uses **camelCase**, database uses **snake_case**. Prisma handles the mapping:

| Code (TypeScript) | Database (PostgreSQL) |
|-------------------|----------------------|
| `fullName` | `full_name` |
| `emailVerified` | `email_verified` |
| `createdAt` | `created_at` |
| `User` (model) | `users` (table) |

### Prisma Schema Convention

```prisma
model User {
  fullName  String  @map("full_name")    // Field mapping
  createdAt DateTime @map("created_at")

  @@map("users")                          // Table mapping
}
```

### Adding New Models

When creating new Prisma models, always:
1. Use camelCase for field names in schema
2. Add `@map("snake_case")` for multi-word fields
3. Add `@@map("table_name")` for table name (plural, snake_case)
4. Use `@db.Uuid` for UUID fields

Example:
```prisma
model BlogPost {
  id          Int      @id @default(autoincrement())
  uid         String   @unique @default(uuid()) @db.Uuid
  title       String
  authorId    Int      @map("author_id")
  publishedAt DateTime? @map("published_at")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  @@map("blog_posts")
}
```

## Common Patterns

### Pagination
```typescript
@Get()
findAll(@Query() query: PaginationQueryDto) {
  return this.service.findAll(query.page, query.limit);
}
```

### Error Handling
```typescript
if (!entity) {
  throw new NotFoundException('Entity not found');
}
```

### Transaction Example
```typescript
await this.prisma.$transaction(async (tx) => {
  await tx.user.update({ ... });
  await tx.audit.create({ ... });
});
```

## Development Commands

```bash
npm run start:dev      # Development with hot reload
npm run build          # Build for production
npm run start:prod     # Run production build
npm run lint           # Lint code
npm run format         # Format code
npm run test           # Run tests
npm run prisma:studio  # Open Prisma Studio
```

## Tech Stack

- NestJS 11.x
- PostgreSQL 16 + Prisma 6.x
- Redis 7 (ioredis)
- Passport.js + JWT
- class-validator + class-transformer
- Swagger/OpenAPI
- Pino logger
- AWS SES (email)
- Cloudflare R2 (file storage)
- Helmet.js
- Zod (env validation)
