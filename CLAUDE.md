# Claude Code Documentation

NestJS backend template with authentication (JWT + Passkey/WebAuthn), user management, and layered architecture.

## Quick Commands

```bash
pnpm install                 # Install dependencies
pnpm start:dev               # Start development server
pnpm build                   # Build for production
pnpm test                    # Run unit tests
pnpm lint                    # Lint code
pnpm prisma:push             # Push schema to DB (dev)
pnpm prisma:migrate          # Create migration
pnpm prisma:generate         # Generate Prisma client
pnpm prisma:seed             # Seed database
pnpm prisma:studio           # Open Prisma Studio
pnpm generate:module <name>  # Generate CRUD module
```

## Project Structure

```
src/
├── main.ts                     # Entry point
├── app.module.ts               # Root module
├── config/                     # Environment config (Zod validation)
├── core/                       # Cross-cutting concerns
│   ├── decorators/             # @CurrentUser, @Roles, @Public, @SkipWrapper
│   ├── guards/                 # JwtAuthGuard, RolesGuard
│   ├── filters/                # HttpExceptionFilter
│   ├── interceptors/           # ResponseWrapperInterceptor
│   └── middleware/             # CorrelationIdMiddleware
├── infra/                      # Infrastructure
│   ├── prisma/                 # Database (PrismaService)
│   ├── logger/                 # Pino logger
│   ├── redis/                  # Cache (RedisService, UserCacheService)
│   ├── mail/                   # Email (MailService - AWS SES)
│   └── storage/                # Files (StorageService - Cloudflare R2)
├── common/                     # Shared utilities
│   ├── dto/                    # PaginationQueryDto, PaginationMetaDto
│   ├── types/                  # CurrentUserPayload
│   └── exceptions/             # Api*Exception classes
└── modules/                    # Feature modules
    ├── auth/                   # Authentication
    ├── users/                  # User management
    ├── upload/                 # File upload
    └── health/                 # Health checks
```

## Module Structure

```
{module}/
├── {module}.module.ts          # NestJS module
├── {module}.controller.ts      # HTTP endpoints
├── {module}.service.ts         # Business logic
├── dto/
│   ├── request/                # Input DTOs (class-validator)
│   └── response/               # Output DTOs (static fromEntity)
└── index.ts                    # Barrel exports
```

## Path Aliases

| Alias | Path |
|-------|------|
| `@/*` | src/* |
| `@config` | src/config |
| `@modules` | src/modules |
| `@infra/*` | src/infra/* |
| `@common/*` | src/common/* |
| `@core/*` | src/core/* |

## Key Imports

```typescript
// Types
import { CurrentUserPayload } from '@common/types';
import { Role } from '@prisma/client';

// Decorators
import { CurrentUser, Roles, Public, SkipResponseWrapper } from '@core/decorators';

// Guards
import { RolesGuard } from '@core/guards';

// Services
import { PrismaService } from '@infra/prisma/prisma.service';
import { MailService } from '@infra/mail/mail.service';
import { StorageService } from '@infra/storage';
import { RedisService, UserCacheService } from '@infra/redis';

// Common DTOs
import { PaginationQueryDto } from '@common/dto/pagination.dto';

// Exceptions
import { ApiBadRequestException, ApiNotFoundException } from '@common/exceptions';
```

## File Naming

| Type | Pattern |
|------|---------|
| Module | `{entity}.module.ts` |
| Controller | `{entity}.controller.ts` |
| Service | `{entity}.service.ts` |
| Create DTO | `create-{entity}.dto.ts` |
| Update DTO | `update-{entity}.dto.ts` |
| Query DTO | `get-{entities}-query.dto.ts` |
| Response | `{entity}.response.ts` |
| Unit Test | `{file}.spec.ts` (co-located) |

## Database Conventions

- **Code**: camelCase (`fullName`, `createdAt`)
- **Database**: snake_case (`full_name`, `created_at`)
- **Tables**: plural snake_case (`users`, `blog_posts`)
- **Primary Key**: UUID with `@db.Uuid`
- **Soft Deletes**: `deletedAt` field (never hard delete)

```prisma
model Entity {
  id        String    @id @default(uuid()) @db.Uuid
  title     String
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")

  @@index([deletedAt])
  @@map("entities")
}
```

## Code Patterns

### Controller with Auth

```typescript
@ApiTags('Entities')
@ApiBearerAuth()
@Controller('entities')
export class EntitiesController {
  constructor(private readonly service: EntitiesService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.superadmin, Role.admin)
  async findAll(@Query() query: GetEntitiesQueryDto) {
    const { data, meta } = await this.service.findAll(query);
    return { data: data.map(EntityResponse.fromEntity), meta };
  }

  @Post()
  async create(
    @Body() dto: CreateEntityDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const entity = await this.service.create(dto, user);
    return EntityResponse.fromEntity(entity);
  }
}
```

### Service with Pagination

```typescript
@Injectable()
export class EntitiesService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: GetEntitiesQueryDto) {
    const { page = 1, limit = 10, search } = query;
    const skip = (page - 1) * limit;

    const where = {
      deletedAt: null,
      ...(search && { title: { contains: search, mode: 'insensitive' as const } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.entity.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.entity.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
      data,
      meta: { total, page, limit, totalPages, hasNextPage: page < totalPages, hasPreviousPage: page > 1 },
    };
  }

  async findById(id: string) {
    const entity = await this.prisma.entity.findFirst({ where: { id, deletedAt: null } });
    if (!entity) throw new NotFoundException('Entity not found');
    return entity;
  }

  async delete(id: string) {
    await this.findById(id);
    return this.prisma.entity.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
```

### Response DTO

```typescript
export class EntityResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  createdAt: Date;

  static fromEntity(entity: Entity): EntityResponse {
    return { id: entity.id, title: entity.title, createdAt: entity.createdAt };
  }
}
```

### Request DTO

```typescript
export class CreateEntityDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  title: string;
}

export class GetEntitiesQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;
}
```

## Response Format

**Single resource** - returned directly (no wrapper)

**Paginated list** - `{ data: [...], meta: { total, page, limit, totalPages, hasNextPage, hasPreviousPage } }`

**Error** - `{ error: { code, message, details?, timestamp, path, requestId } }`

## Error Codes

| Code | Status | Usage |
|------|--------|-------|
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `BAD_REQUEST` | 400 | Invalid request |
| `UNAUTHORIZED` | 401 | Auth required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

## Decorators

| Decorator | Purpose |
|-----------|---------|
| `@Public()` | Skip JWT auth |
| `@CurrentUser()` | Get authenticated user |
| `@Roles(Role.admin)` | Restrict to roles (use with RolesGuard) |
| `@SkipResponseWrapper()` | Skip response wrapper |

## Roles

`Role.superadmin` | `Role.admin` | `Role.user`

## Passkey (WebAuthn) Authentication

Passkey support via `@simplewebauthn/server`. Users register passkeys after signing in with password, then can authenticate using passkeys.

### Passkey Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/passkey/auth/options` | Public | Generate authentication options |
| POST | `/auth/passkey/auth/verify` | Public | Verify passkey authentication (returns tokens) |
| POST | `/auth/passkey/register/options` | JWT | Generate registration options |
| POST | `/auth/passkey/register/verify` | JWT | Verify registration (stores passkey) |
| GET | `/auth/passkeys` | JWT | List current user's passkeys |
| DELETE | `/auth/passkeys/:id` | JWT | Delete a passkey |

### Passkey Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PASSKEY_RP_NAME` | Relying party display name | My App |
| `PASSKEY_RP_ID` | Relying party ID (domain) | localhost |
| `PASSKEY_ORIGIN` | Expected origin URL | http://localhost:3000 |

### Passkey Database Models

```prisma
model Passkey {
  id           String   @id @default(uuid()) @db.Uuid
  userId       String   @map("user_id") @db.Uuid
  credentialId String   @unique @map("credential_id")
  publicKey    String   @map("public_key")
  counter      Int      @default(0)
  transports   String[] @default([])
  deviceType   String?  @map("device_type")
  backedUp     Boolean  @default(false) @map("backed_up")
  name         String?
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id])
  @@map("passkeys")
}

model PasskeyChallenge {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String?  @map("user_id") @db.Uuid
  challenge String
  type      String
  expiresAt DateTime @map("expires_at")
  createdAt DateTime @default(now()) @map("created_at")

  user User? @relation(fields: [userId], references: [id])
  @@map("passkey_challenges")
}
```

## Module Generation

```bash
pnpm generate:module product
```

Generates full CRUD module with:
- Controller, Service, Module files
- DTOs (create, update, query, response)
- Auto-registers in app.module.ts

After generation:
1. Add Prisma model to `prisma/schema.prisma`
2. Run `pnpm prisma:push` or `pnpm prisma:migrate`

## Code Style

**IMPORTANT: Do not write any comments in code.** All documentation should be in README.md, CLAUDE.md, or .cursorrules. Code should be self-documenting through clear naming and structure.

- No comments in code - document in README/CLAUDE.md/.cursorrules
- Use barrel exports (index.ts) for all directories
- Use static factory methods for response DTOs
- Use soft deletes (deletedAt) for data
- Use UUID for primary keys
- All endpoints return consistent response structures
