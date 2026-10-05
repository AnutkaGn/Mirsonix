import { STATUS_CODES } from 'node:http';
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ApiError } from '@mirsonix/shared';
import type { Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import type { ZodError } from 'zod';

/** Normalises every error to the shared ApiError shape. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const body = this.toBody(exception);
    if (exception instanceof HttpException) {
      // A deliberate 5xx (e.g. storage not configured) is a known state: one line, no stack.
      if (body.statusCode >= 500) this.logger.warn(`${body.statusCode} ${body.message}`);
    } else {
      this.logger.error(exception); // unexpected: keep the stack
    }
    res.status(body.statusCode).json(body);
  }

  toBody(exception: unknown): ApiError {
    if (exception instanceof ZodValidationException) {
      const zodError = exception.getZodError() as ZodError;
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        error: reasonPhrase(HttpStatus.BAD_REQUEST),
        message: 'Validation failed',
        details: zodError.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const response = exception.getResponse();
      const message =
        typeof response === 'string'
          ? response
          : ((response as { message?: string | string[] }).message ?? exception.message);
      return {
        statusCode: status,
        error: reasonPhrase(status),
        message: Array.isArray(message) ? message.join('; ') : message,
      };
    }
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: reasonPhrase(HttpStatus.INTERNAL_SERVER_ERROR),
      message: 'Unexpected error',
    };
  }
}

/** The standard HTTP reason phrase ("Not Found"), not a class name that leaks implementation details. */
const reasonPhrase = (status: number): string => STATUS_CODES[status] ?? 'Error';
