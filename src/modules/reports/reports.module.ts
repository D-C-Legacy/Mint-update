import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../platform/database/database.module';
import { AuthModule } from '../../platform/auth/auth.module';
import { RateLimitModule } from '../../platform/rate-limit/rate-limit.module';
import { REPORT_REPOSITORY } from './domain/ports/report.repository.port';
import { ReportPrismaRepository } from './infra/repositories/report.prisma.repository';
import { ReportsService } from './application/reports.service';
import { ReportsController } from './api/http/reports.controller';

@Module({
  imports: [DatabaseModule, AuthModule, RateLimitModule],
  controllers: [ReportsController],
  providers: [{ provide: REPORT_REPOSITORY, useClass: ReportPrismaRepository }, ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
