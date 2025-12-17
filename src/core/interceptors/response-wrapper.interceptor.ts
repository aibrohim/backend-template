import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { ApiSuccessResponse } from '@common/types';

export const SKIP_RESPONSE_WRAPPER = 'skipResponseWrapper';

@Injectable()
export class ResponseWrapperInterceptor implements NestInterceptor {
  constructor(private reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const skipWrapper = this.reflector.getAllAndOverride<boolean>(SKIP_RESPONSE_WRAPPER, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skipWrapper) {
      return next.handle();
    }

    return next.handle().pipe(
      map((response) => {
        if (response === null || response === undefined) {
          return { data: null };
        }

        if (this.isAlreadyWrapped(response)) {
          return response;
        }

        if (this.isPaginatedResponse(response)) {
          return response;
        }

        return { data: response } as ApiSuccessResponse<typeof response>;
      }),
    );
  }

  private isAlreadyWrapped(response: unknown): boolean {
    if (typeof response !== 'object' || response === null) {
      return false;
    }

    const keys = Object.keys(response);
    return keys.includes('data') && (keys.length === 1 || keys.includes('meta'));
  }

  private isPaginatedResponse(response: unknown): boolean {
    if (typeof response !== 'object' || response === null) {
      return false;
    }

    const obj = response as Record<string, unknown>;
    return (
      Array.isArray(obj.data) &&
      typeof obj.meta === 'object' &&
      obj.meta !== null &&
      'total' in obj.meta
    );
  }
}
