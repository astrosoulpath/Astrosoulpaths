import {
  Controller,
  Get,
  Header,
  UseGuards,
} from '@nestjs/common';

import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
  ) {}

  /**
   * Public homepage counters.
   *
   * GET /dashboard/public-stats
   */
  @Get('public-stats')
  @Header(
    'Cache-Control',
    'public, max-age=60, stale-while-revalidate=300',
  )
  getPublicStats() {
    return this.dashboardService.getPublicStats();
  }

  /**
   * Authenticated dashboard statistics.
   *
   * GET /dashboard/stats
   *
   * Abhi Supabase authentication protected hai.
   * Admin role guard baad mein Option 10 mein add hoga.
   */
  @Get('stats')
  @UseGuards(SupabaseAuthGuard)
  @Header(
    'Cache-Control',
    'private, no-store',
  )
  getAdminStats() {
    return this.dashboardService.getAdminStats();
  }
}