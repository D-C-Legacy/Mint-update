import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ReportsService } from '../../application/reports.service';
import { ZodValidationPipe } from '../../../../platform/validation/zod-validation.pipe';
import { JwtGuard, AuthenticatedUser } from '../../../../platform/auth/jwt.guard';
import { CurrentUser } from '../../../../platform/auth/current-user.decorator';
import { DefaultRateLimitGuard } from '../../../../platform/rate-limit/default-rate-limit.guard';
import { CreateReportSchema, CreateReportDto } from './dto/create-report.dto';
import { toReportView } from './report.view';

// Not in 05-API-SPEC.md. Any authenticated user may flag a review or a message; admin reads and
// resolves the queue (AdminController, see admin.service.ts's report methods).
@Controller()
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post('reports')
  @UseGuards(JwtGuard, DefaultRateLimitGuard)
  async create(
    @Body(new ZodValidationPipe(CreateReportSchema)) dto: CreateReportDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ data: unknown }> {
    const report = await this.reports.create({
      targetType: dto.targetType,
      targetId: dto.targetId,
      reporterUserId: user.id,
      reason: dto.reason,
    });
    return { data: toReportView(report, null) };
  }
}
