import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SearchService } from './search.service';

@Controller()
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  /**
   * GET /search?q=termo
   *
   * Busca global em cursos, aulas, FAQs e competências.
   *
   * Regras de permissão:
   * - ALUNO (USER): apenas conteúdo PUBLISHED
   * - GESTOR (MANAGER/ADMIN/ADMIN_MASTER): pode ver DRAFT, REVIEWED, APPROVED
   *
   * Retorna resultados agrupados por tipo.
   */
  @Get('search')
  @UseGuards(JwtAuthGuard)
  async search(@Query('q') query: string, @Request() req: any) {
    return this.searchService.search(query, req.user.instituteId, req.user.role);
  }
}
