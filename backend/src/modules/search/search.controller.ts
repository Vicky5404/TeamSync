import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { AccessContext } from '../../common/auth/auth.types.js';
import { Access } from '../../common/auth/decorators.js';

import { SearchQueryDto, SearchResultsDto } from './search.dto.js';
import { SearchService } from './search.service.js';

@ApiTags('Search')
@ApiBearerAuth()
@Controller('organizations/:organizationId/search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Search projects, tasks (title or identifier) and members' })
  @ApiOkResponse({ type: SearchResultsDto })
  search(
    @Access() access: AccessContext,
    @Query() query: SearchQueryDto,
  ): Promise<SearchResultsDto> {
    return this.searchService.search(access.organizationId, query.q, query.limit);
  }
}
