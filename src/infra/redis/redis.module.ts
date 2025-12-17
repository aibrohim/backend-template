import { Global, Module } from '@nestjs/common';

import { RedisService } from './redis.service';
import { UserCacheService } from './user-cache.service';

@Global()
@Module({
  providers: [RedisService, UserCacheService],
  exports: [RedisService, UserCacheService],
})
export class RedisModule {}
