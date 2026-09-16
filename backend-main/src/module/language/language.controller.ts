import { Controller, Get, Param } from '@nestjs/common';

import { LanguageService } from './language.service';

@Controller('languages')
export class LanguageController {
  constructor(private readonly languageService: LanguageService) {}

  @Get()
  getLanguages() {
    return this.languageService.getLanguages();
  }

  @Get(':code/translations')
  getTranslations(@Param('code') code: string) {
    return this.languageService.getTranslations(code);
  }

}
