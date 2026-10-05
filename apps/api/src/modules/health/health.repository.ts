import { Injectable } from '@nestjs/common';

/** Placeholder: gains a real DB ping once TypeORM is wired in (Step 2). */
@Injectable()
export class HealthRepository {
  async isDatabaseReachable(): Promise<boolean> {
    return true;
  }
}
