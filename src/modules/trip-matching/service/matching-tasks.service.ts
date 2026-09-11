import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TripMatchingService } from './trip-matching.service';

/**
 * Scheduled driver of the matching pipeline. Kept separate from the service so
 * the pure logic stays unit-testable and can also be triggered on demand.
 */
@Injectable()
export class MatchingTasksService {
  private readonly logger = new Logger(MatchingTasksService.name);

  constructor(private readonly matching: TripMatchingService) {}

  /**
   * Every 5 minutes: group new requests, then push any pool that has crossed
   * its board window (12h intra / 18h inter before departure) to drivers, and
   * expire pools whose departure has passed.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async runPipeline() {
    try {
      const matched = await this.matching.matchPendingRequests();
      const dispatched = await this.matching.dispatchDuePools();
      const expired = await this.matching.expireStalePools();
      const expiredRequests = await this.matching.expireStaleRequests();

      if (matched.pooled || dispatched.dispatched || expired.expired || expiredRequests.expired) {
       this.logger.log(
          `Matching pipeline: pooled=${matched.pooled}, ` +
            `dispatched=${dispatched.dispatched}, expired=${expired.expired}, ` +
            `expiredRequests=${expiredRequests.expired}`,
        );
      }
    } catch (err) {
      this.logger.error(`Matching pipeline failed: ${err?.message}`, err?.stack);
    }
  }
}
