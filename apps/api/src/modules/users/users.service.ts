import { Injectable } from '@nestjs/common';
import type { AuthProvider } from '@mirsonix/shared';
import type { AuthIdentity } from './entities/auth-identity.entity';
import type { User } from './entities/user.entity';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly repository: UsersRepository) {}

  findById(id: string): Promise<User | null> {
    return this.repository.findById(id);
  }

  findByStripeCustomerId(stripeCustomerId: string): Promise<User | null> {
    return this.repository.findByStripeCustomerId(stripeCustomerId);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.repository.findByEmail(email);
  }

  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.repository.findByEmailWithPassword(email);
  }

  create(data: Partial<User>): Promise<User> {
    return this.repository.create(data);
  }

  update(id: string, patch: Partial<User>): Promise<void> {
    return this.repository.update(id, patch);
  }

  findIdentity(provider: AuthProvider, providerUserId: string): Promise<AuthIdentity | null> {
    return this.repository.findIdentity(provider, providerUserId);
  }

  linkIdentity(userId: string, provider: AuthProvider, providerUserId: string): Promise<void> {
    return this.repository.linkIdentity(userId, provider, providerUserId);
  }

  createWithIdentity(data: Partial<User>, provider: AuthProvider, providerUserId: string): Promise<User> {
    return this.repository.createWithIdentity(data, provider, providerUserId);
  }
}
