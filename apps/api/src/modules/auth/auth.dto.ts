import { authSessionSchema, authUserSchema, loginSchema, registerSchema } from '@mirsonix/shared';
import { createZodDto } from 'nestjs-zod';

export class RegisterDto extends createZodDto(registerSchema) {}
export class LoginDto extends createZodDto(loginSchema) {}
export class AuthSessionDto extends createZodDto(authSessionSchema) {}
export class AuthUserDto extends createZodDto(authUserSchema) {}
