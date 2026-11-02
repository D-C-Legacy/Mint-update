import { Controller, Get, Query } from '@nestjs/common';
import { HelpService } from '../../application/help.service';
import { ZodValidationPipe } from '../../../../platform/validation/zod-validation.pipe';
import { ListHelpQuerySchema, ListHelpQueryDto } from './dto/list-help-query.dto';
import { toHelpArticleView } from './help-article.view';

// GET /v1/help/articles — fully public, same "no guard" precedent as GET /categories. Not in
// 05-API-SPEC.md: recommended (Phase 8 scoping, 13 Oct 2026) over a hardcoded in-app FAQ so staff
// can edit content without an app release. Admin CRUD lives in AdminController.
@Controller()
export class HelpController {
  constructor(private readonly help: HelpService) {}

  @Get('help/articles')
  async listPublished(
    @Query(new ZodValidationPipe(ListHelpQuerySchema)) query: ListHelpQueryDto,
  ): Promise<{ data: unknown }> {
    const articles = await this.help.listPublished(query.category);
    return { data: { items: articles.map(toHelpArticleView) } };
  }
}
