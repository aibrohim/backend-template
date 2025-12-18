import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

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
          return null;
        }

        if (this.isPaginatedResponse(response)) {
          return response;
        }

        return response;
      }),
    );
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
