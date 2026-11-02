import { Inject, Injectable } from '@nestjs/common';
import { generateId } from '../../../shared/ids/id';
import { Result, Ok, Err } from '../../../shared/result/result';
import { HELP_REPOSITORY, HelpRepositoryPort, UpdateHelpArticleInput } from '../domain/ports/help.repository.port';
import { HelpArticle } from '../domain/entities/help-article.entity';
import { HelpArticleNotFoundError } from '../domain/errors/help.errors';

export interface CreateHelpArticleCommand {
  readonly category: string;
  readonly title: string;
  readonly body: string;
  readonly sortOrder: number;
}

// CRUD this plain doesn't earn a dedicated commands/queries split the way reviews/messaging's
// real business rules do — same "no domain rule, behaviour is the CRUD itself" precedent Phase 2
// (preferences) and Phase 3 (addresses, minus its one real cap rule) already set in this project.
@Injectable()
export class HelpService {
  constructor(@Inject(HELP_REPOSITORY) private readonly help: HelpRepositoryPort) {}

  // GET /v1/help/articles — fully public, published only.
  async listPublished(category: string | undefined): Promise<HelpArticle[]> {
    return this.help.listPublished(category);
  }

  // GET /admin/help/articles — every article, published or not.
  async adminListAll(): Promise<HelpArticle[]> {
    return this.help.listAll();
  }

  async adminCreate(cmd: CreateHelpArticleCommand): Promise<HelpArticle> {
    return this.help.create({ id: generateId(), ...cmd });
  }

  async adminUpdate(id: string, input: UpdateHelpArticleInput): Promise<Result<HelpArticle, HelpArticleNotFoundError>> {
    const updated = await this.help.update(id, input);
    if (!updated) {
      return Err(new HelpArticleNotFoundError(id));
    }
    return Ok(updated);
  }

  async adminDelete(id: string): Promise<Result<true, HelpArticleNotFoundError>> {
    const deleted = await this.help.delete(id);
    if (!deleted) {
      return Err(new HelpArticleNotFoundError(id));
    }
    return Ok(true);
  }
}
