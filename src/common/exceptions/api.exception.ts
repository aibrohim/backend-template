import { HttpException, HttpStatus } from '@nestjs/common';

export interface ApiExceptionParams {
  errorCode: string;
  statusCode?: HttpStatus;
  metadata?: Record<string, unknown>;
  error?: Error;
}

export type ApiExceptionParamsWithoutStatus = Omit<ApiExceptionParams, 'statusCode'>;

export class ApiException extends HttpException {
  constructor(message: string, params: ApiExceptionParams) {
    super(
      {
        errorCode: params.errorCode,
        message,
        statusCode: params.statusCode ?? HttpStatus.BAD_REQUEST,
        timestamp: new Date().toISOString(),
        metadata: params.metadata,
        error: params.error,
      },
      params.statusCode ?? HttpStatus.BAD_REQUEST,
    );
  }
}

export class ApiBadRequestException extends ApiException {
  constructor(message: string, params?: ApiExceptionParamsWithoutStatus) {
    super(message, {
      ...params,
      errorCode: params?.errorCode ?? 'BAD_REQUEST',
      statusCode: HttpStatus.BAD_REQUEST,
    });
  }
}

export class ApiUnauthorizedException extends ApiException {
  constructor(message: string, params?: ApiExceptionParamsWithoutStatus) {
    super(message, {
      ...params,
      errorCode: params?.errorCode ?? 'UNAUTHORIZED',
      statusCode: HttpStatus.UNAUTHORIZED,
    });
  }
}

export class ApiForbiddenException extends ApiException {
  constructor(message: string, params?: ApiExceptionParamsWithoutStatus) {
    super(message, {
      ...params,
      errorCode: params?.errorCode ?? 'FORBIDDEN',
      statusCode: HttpStatus.FORBIDDEN,
    });
  }
}

export class ApiNotFoundException extends ApiException {
  constructor(message: string, params?: ApiExceptionParamsWithoutStatus) {
    super(message, {
      ...params,
      errorCode: params?.errorCode ?? 'NOT_FOUND',
      statusCode: HttpStatus.NOT_FOUND,
    });
  }
}

export class ApiConflictException extends ApiException {
  constructor(message: string, params?: ApiExceptionParamsWithoutStatus) {
    super(message, {
      ...params,
      errorCode: params?.errorCode ?? 'CONFLICT',
      statusCode: HttpStatus.CONFLICT,
    });
  }
}

export class ApiValidationException extends ApiException {
  constructor(message: string, params?: ApiExceptionParamsWithoutStatus) {
    super(message, {
      ...params,
      errorCode: params?.errorCode ?? 'VALIDATION_ERROR',
      statusCode: HttpStatus.BAD_REQUEST,
    });
  }
}

export class ApiInternalErrorException extends ApiException {
  constructor(message: string, params?: ApiExceptionParamsWithoutStatus) {
    super(message, {
      ...params,
      errorCode: params?.errorCode ?? 'INTERNAL_ERROR',
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  }
}
