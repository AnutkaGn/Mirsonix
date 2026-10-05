import { Injectable } from '@nestjs/common';
import type { HealthResponse } from '@mirsonix/shared';
import { HealthRepository } from './health.repository';

@Injectable()
export class HealthService {
  constructor(private readonly repository: HealthRepository) {}

  async check(): Promise<HealthResponse> {
    const databaseUp = await this.repository.isDatabaseReachable();
    return {
      status: databaseUp ? 'ok' : 'degraded',
      database: databaseUp ? 'up' : 'down',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}
