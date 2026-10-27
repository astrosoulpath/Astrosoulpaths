import { Controller, Get, Header, UseFilters } from '@nestjs/common';
import { SupportCatalogueService } from './support-catalogue.service';
import { SupportErrorFilter } from './support-error.filter';

/** Explicitly published information only. No auth, tickets, AI knowledge or private notes. */
@Controller('support/public')
@UseFilters(SupportErrorFilter)
export class SupportPublicController {
  constructor(private readonly catalogue: SupportCatalogueService) {}
  @Get('help')
  @Header('Cache-Control', 'no-store')
  help() {
    return this.catalogue.publicHelp();
  }
}
