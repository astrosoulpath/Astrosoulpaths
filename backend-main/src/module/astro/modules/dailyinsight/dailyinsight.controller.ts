import { Controller, Get } from '@nestjs/common';
import { NakshatraDailyInsightService } from './dailyinsight.service';
import { Public } from '../../../../common/decorators/public.decorator';

@Public()
@Controller('dailyinsight')
export class DailyinsightController {
  constructor(
    private readonly dailyInsightService: NakshatraDailyInsightService,
  ) {}

  // 🔮 GET /dailyinsight
  @Get()
  async getDailyInsight() {
    return this.dailyInsightService.getNakshatraDailyInsight();
  }
}
