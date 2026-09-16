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

  @Post('oauth/bootstrap')
  @UseGuards(SupabaseAuthGuard)
  async bootstrapOAuthUser(@CurrentUser() jwt: JWTPayload) {
    const readString = (value: unknown): string | null =>
      typeof value === 'string' && value.trim() ? value.trim() : null;

    const supabaseId = readString(jwt.sub);

    if (!supabaseId) {
      throw new Error('Authenticated user ID is missing');
    }

    const metadata =
      jwt.user_metadata && typeof jwt.user_metadata === 'object'
        ? (jwt.user_metadata as Record<string, unknown>)
        : {};

    const fullName =
      readString(metadata.full_name) ?? readString(metadata.name);

    const avatarUrl =
      readString(metadata.avatar_url) ?? readString(metadata.picture);

    const { user, isNewUser } = await this.userService.syncUser({
      supabaseId,
      email: readString(jwt.email),
      phone: readString(jwt.phone),
      fullName,
      avatarUrl,
    });

    return {
      success: true,
      data: {
        user: {
          id: user.id,
          supabaseId: user.supabaseId,
          name: user.name,
          email: user.email,
          phone: user.phone,
          avatarUrl: user.avatarUrl,
          isAstrologer: user.isAstrologer,
          isProfileComplete: user.isProfileComplete,
        },
        isNewUser,
      },
    };
  }
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
