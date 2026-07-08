import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import type { JWTPayload } from 'jose';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { AstrologerService } from './astrologer.service';
import { RegisterAstrologerDto } from './dto/register-astrologer.dto';

@Controller('astrologer')
export class AstrologerController {
  constructor(private readonly astrologerService: AstrologerService) {}

  @Post('register')
  @UseGuards(SupabaseAuthGuard)
  register(
    @CurrentUser() user: JWTPayload,
    @Body() dto: RegisterAstrologerDto,
  ) {
    return this.astrologerService.register(user.sub as string, dto);
  }
}