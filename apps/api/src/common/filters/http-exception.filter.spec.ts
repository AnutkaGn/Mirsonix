import { BadRequestException, HttpException, NotFoundException } from '@nestjs/common';
import { ZodValidationException } from 'nestjs-zod';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AllExceptionsFilter } from './http-exception.filter';

const filter = new AllExceptionsFilter();

describe('AllExceptionsFilter.toBody', () => {
  it('uses the HTTP reason phrase, not the exception class name', () => {
    expect(filter.toBody(new NotFoundException('nope'))).toEqual({ statusCode: 404, error: 'Not Found', message: 'nope' });
    expect(filter.toBody(new HttpException('slow down', 429))).toMatchObject({ statusCode: 429, error: 'Too Many Requests' });
  });

  it('joins a message array into one string', () => {
    expect(filter.toBody(new BadRequestException(['a is required', 'b is too long']))).toMatchObject({
      message: 'a is required; b is too long',
    });
  });

  it('turns a Zod failure into 400 with a per-field list', () => {
    const result = z.object({ email: z.email(), age: z.number() }).safeParse({ email: 'x', age: 'y' });
    if (result.success) throw new Error('expected the parse to fail');

    const body = filter.toBody(new ZodValidationException(result.error));

    expect(body).toMatchObject({ statusCode: 400, error: 'Bad Request', message: 'Validation failed' });
    expect(body.details?.map((d) => d.path)).toEqual(['email', 'age']);
  });

  it('hides the details of an unexpected error', () => {
    expect(filter.toBody(new Error('connection string postgres://secret'))).toEqual({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Unexpected error',
    });
  });
});
