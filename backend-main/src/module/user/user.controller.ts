import {
  Controller,
  Get,
  Param,
  Patch,
  Body,
  UseGuards,
  Post,
} from '@nestjs/common';
import type { JWTPayload } from 'jose';
import { UserService } from './user.service';
import { Roles, Role } from '../../common/decorators/roles.decorator';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateUserProfileDto } from './dto/create-user-profile.dto';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  @UseGuards(SupabaseAuthGuard)
  getProfile(@CurrentUser() user: JWTPayload) {
    return this.userService.getProfile(user.sub as string);
  }

  @Post('profile')
  @UseGuards(SupabaseAuthGuard)
  createProfile(
    @CurrentUser() user: JWTPayload,
    @Body() dto: CreateUserProfileDto,
  ) {
    return this.userService.createProfile(user.sub as string, dto);
  }

  @Patch('profile')
  @UseGuards(SupabaseAuthGuard)
  updateProfile(
    @CurrentUser() user: JWTPayload,
    @Body() dto: UpdateUserProfileDto,
  ) {
    return this.userService.updateProfile(user.sub as string, dto);
  }

  // 👤 Get user by ID
  @Get(':id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  findOne(@Param('id') id: string) {
    return this.userService.findOne(id); // ✅ no +
  }

  // 📄 Get users (pagination later)
  @Get()
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  findAll() {
    return this.userService.findAll();
  }

  // ✏️ Update profile
  @Patch(':id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  update(@Param('id') id: string, @Body() body: { phone?: string }) {
    return this.userService.update(id, body);
  }
}
