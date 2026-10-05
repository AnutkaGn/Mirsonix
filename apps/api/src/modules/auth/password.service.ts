import { Injectable, type OnModuleInit } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { AppConfig } from '../../config/app-config.module';

@Injectable()
export class PasswordService implements OnModuleInit {
  private dummyHash!: string;

  constructor(private readonly config: AppConfig) {}

  async onModuleInit(): Promise<void> {
    this.dummyHash = await this.hash('timing-equaliser-not-a-real-password');
  }

  hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.config.get('BCRYPT_COST'));
  }

  /**
   * Always performs one bcrypt comparison, even when the account is unknown or has no password, so response
   * time does not reveal whether an email is registered.
   */
  async verify(plain: string, hash: string | null | undefined): Promise<boolean> {
    const valid = await bcrypt.compare(plain, hash ?? this.dummyHash);
    return hash ? valid : false;
  }
}
