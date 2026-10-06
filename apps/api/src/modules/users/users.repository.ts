import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AuthProvider } from '@mirsonix/shared';
import { Repository } from 'typeorm';
import { AuthIdentity } from './entities/auth-identity.entity';
import { User } from './entities/user.entity';

@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(AuthIdentity) private readonly identities: Repository<AuthIdentity>,
  ) {}

  /** Soft-deleted users are excluded by TypeORM unless asked for. */
  findById(id: string): Promise<User | null> {
    return this.users.findOneBy({ id });
  }

  findByStripeCustomerId(stripeCustomerId: string): Promise<User | null> {
    return this.users.findOneBy({ stripeCustomerId });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.users.findOneBy({ email });
  }

  /** password_hash is select:false, so credential checks must opt in explicitly. */
  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.users.createQueryBuilder('u').addSelect('u.passwordHash').where('u.email = :email', { email }).getOne();
  }

  create(data: Partial<User>): Promise<User> {
    return this.users.save(this.users.create(data));
  }

  async update(id: string, patch: Partial<User>): Promise<void> {
    await this.users.update(id, patch);
  }

  findIdentity(provider: AuthProvider, providerUserId: string): Promise<AuthIdentity | null> {
    return this.identities.findOne({ where: { provider, providerUserId }, relations: { user: true } });
  }

  async linkIdentity(userId: string, provider: AuthProvider, providerUserId: string): Promise<void> {
    await this.identities.insert({ userId, provider, providerUserId });
  }

  /** New account and its identity are created together or not at all. */
  createWithIdentity(data: Partial<User>, provider: AuthProvider, providerUserId: string): Promise<User> {
    return this.users.manager.transaction(async (em) => {
      const user = await em.save(User, em.create(User, data));
      await em.insert(AuthIdentity, { userId: user.id, provider, providerUserId });
      return user;
    });
  }
}
