import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ThrottlerException } from '@nestjs/throttler';

import { ApiException } from '@common/exceptions';
import { ApiErrorResponse, ApiErrorDetail, ERROR_CODES, ErrorCode } from '@common/types';
import { RequestWithCorrelationId } from '@core/middleware';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithCorrelationId>();

    const { status, code, message, details, metadata } = this.extractErrorInfo(exception);
    const correlationId = request.correlationId || '-';

    const errorResponse: ApiErrorResponse = {
      error: {
        code,
        message,
        details: details.length > 0 ? details : undefined,
        metadata,
        timestamp: new Date().toISOString(),
        path: request.url,
        requestId: correlationId,
      },
    };

    if (status >= 500) {
      this.logger.error(
        `[${correlationId}] ${request.method} ${request.url} - ${status} - ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `[${correlationId}] ${request.method} ${request.url} - ${status} - ${message}`,
      );
    }

    response.status(status).json(errorResponse);
  }

  private extractErrorInfo(exception: unknown): {
    status: number;
    code: ErrorCode;
    message: string;
    details: ApiErrorDetail[];
    metadata?: Record<string, unknown>;
  } {
    if (exception instanceof ThrottlerException) {
      return {
        status: HttpStatus.TOO_MANY_REQUESTS,
        code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
        message: 'Too many requests. Please try again later.',
        details: [],
      };
    }

    if (exception instanceof ApiException) {
      const response = exception.getResponse() as Record<string, unknown>;
      return {
        status: exception.getStatus(),
        code: (response.errorCode as ErrorCode) || ERROR_CODES.INTERNAL_ERROR,
        message: (response.message as string) || 'An error occurred',
        details: [],
        metadata: response.metadata as Record<string, unknown>,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const { code, message, details } = this.parseHttpException(status, exceptionResponse);

      return { status, code, message, details };
    }

    this.logger.error('Unhandled exception:', exception);

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ERROR_CODES.INTERNAL_ERROR,
      message: 'An unexpected error occurred',
      details: [],
    };
  }

  private parseHttpException(
    status: number,
    exceptionResponse: string | object,
  ): { code: ErrorCode; message: string; details: ApiErrorDetail[] } {
    const code = this.mapStatusToCode(status);
    let message: string;
    let details: ApiErrorDetail[] = [];

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (typeof exceptionResponse === 'object') {
      const response = exceptionResponse as Record<string, unknown>;
      message = (response.message as string) || 'An error occurred';

      if (Array.isArray(response.message)) {
        message = 'Validation failed';
        details = response.message.map((msg: string) => this.parseValidationMessage(msg));
      }
    } else {
      message = 'An error occurred';
    }

    return { code, message, details };
  }

  private parseValidationMessage(msg: string): ApiErrorDetail {
    let field = 'unknown';

    const propertyMatch = msg.match(/^property (\w+)/);
    if (propertyMatch) {
      field = propertyMatch[1];
    } else {
      const parts = msg.split(' ');
      if (parts.length > 0 && /^[a-zA-Z_]\w*$/.test(parts[0])) {
        field = parts[0];
      }
    }

    return { field, message: msg };
  }

  private mapStatusToCode(status: number): ErrorCode {
    const statusCodeMap: Record<number, ErrorCode> = {
      [HttpStatus.BAD_REQUEST]: ERROR_CODES.BAD_REQUEST,
      [HttpStatus.UNAUTHORIZED]: ERROR_CODES.UNAUTHORIZED,
      [HttpStatus.FORBIDDEN]: ERROR_CODES.FORBIDDEN,
      [HttpStatus.NOT_FOUND]: ERROR_CODES.NOT_FOUND,
      [HttpStatus.CONFLICT]: ERROR_CODES.CONFLICT,
      [HttpStatus.UNPROCESSABLE_ENTITY]: ERROR_CODES.VALIDATION_ERROR,
      [HttpStatus.TOO_MANY_REQUESTS]: ERROR_CODES.RATE_LIMIT_EXCEEDED,
      [HttpStatus.SERVICE_UNAVAILABLE]: ERROR_CODES.SERVICE_UNAVAILABLE,
    };

    return statusCodeMap[status] || ERROR_CODES.INTERNAL_ERROR;
  }
}
