import { Controller, Get, Query } from '@nestjs/common';
import {
  revenueSeriesSchema,
  statsQuerySchema,
  statsSummarySchema,
  topStatsQuerySchema,
  topStatsSchema,
} from '@mirsonix/shared';
import { createZodDto, ZodSerializerDto } from 'nestjs-zod';
import { Roles } from '../auth/decorators/roles.decorator';
import { StatsService } from './stats.service';

class StatsQueryDto extends createZodDto(statsQuerySchema) {}
class TopStatsQueryDto extends createZodDto(topStatsQuerySchema) {}
class StatsSummaryDto extends createZodDto(statsSummarySchema) {}
class RevenueSeriesDto extends createZodDto(revenueSeriesSchema) {}
class TopStatsDto extends createZodDto(topStatsSchema) {}

@Roles('ADMIN')
@Controller('admin/stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get('summary')
  @ZodSerializerDto(StatsSummaryDto)
  summary(@Query() query: StatsQueryDto) {
    return this.stats.summary(query);
  }

  @Get('revenue')
  @ZodSerializerDto(RevenueSeriesDto)
  revenue(@Query() query: StatsQueryDto) {
    return this.stats.revenueSeries(query);
  }

  @Get('top')
  @ZodSerializerDto(TopStatsDto)
  top(@Query() query: TopStatsQueryDto) {
    return this.stats.top(query);
  }
}
