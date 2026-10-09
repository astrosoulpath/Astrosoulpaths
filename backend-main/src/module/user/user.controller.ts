import { 
  UnauthorizedException,
  Controller,
  BadRequestException,
  Headers,
  ServiceUnavailableException,
  Delete,
  Get,
  Param,
  Patch,
  Body,
  UseGuards,
  Post,
 } from '@nestjs/common';
import type { JWTPayload } from 'jose';
import { 
  UserService  } from './user.service';
import { 
  Roles, Role  } from '../../common/decorators/roles.decorator';
import { 
  SupabaseAuthGuard  } from '../../common/guards/supabase-auth.guard';
import { 
  RolesGuard  } from '../../common/guards/roles.guard';
import { 
  CurrentUser  } from '../../common/decorators/current-user.decorator';
import { 
  CreateUserProfileDto  } from './dto/create-user-profile.dto';
import { 
  UpdateUserProfileDto  } from './dto/update-user-profile.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Delete('account')
  @UseGuards(SupabaseAuthGuard)
  async deleteAccount(
    @CurrentUser() user: JWTPayload,
    @Headers('x-confirm-account-deletion') confirmation?: string,
  ) {
    if (confirmation !== 'DELETE') {
      throw new BadRequestException('Deletion confirmation required');
    }

    throw new ServiceUnavailableException(
      'Account deletion is temporarily unavailable',
    );
  }
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

  @Post('profile/phone/firebase-verify')
  @UseGuards(SupabaseAuthGuard)
  verifyFirebaseProfilePhone(
    @CurrentUser() user: JWTPayload,
    @Body() body: { firebaseIdToken: string },
  ) {
    if ((user as JWTPayload & { firebaseUid?: string }).firebaseUid) {
      throw new UnauthorizedException(
        'Google/Supabase session required to link a profile phone',
      );
    }

    return this.userService.linkFirebaseVerifiedProfilePhone(
      user.sub as string,
      body.firebaseIdToken,
    );
  }
  @Post('profile/phone/send-otp')
  @UseGuards(SupabaseAuthGuard)
  sendProfilePhoneOtp(
    @CurrentUser() user: JWTPayload,
    @Body() body: { phone: string },
  ) {
    return this.userService.sendProfilePhoneOtp(user.sub as string, body.phone);
  }

  @Post('profile/phone/verify-otp')
  @UseGuards(SupabaseAuthGuard)
  verifyProfilePhoneOtp(
    @CurrentUser() user: JWTPayload,
    @Body() body: { phone: string; token: string },
  ) {
    return this.userService.verifyAndLinkProfilePhone(
      user.sub as string,
      body.phone,
      body.token,
    );
  }
  @Patch('profile')
  @UseGuards(SupabaseAuthGuard)
  updateProfile(
    @CurrentUser() user: JWTPayload,
    @Body() dto: UpdateUserProfileDto,
  ) {
    return this.userService.updateProfile(user.sub as string, dto);
  }

  // ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã‹Å“Ãƒâ€šÃ‚Â¤ Get user by ID

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
    return this.userService.findOne(id); // ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦ no +
  }

  // ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œÃƒÂ¢Ã¢â€šÂ¬Ã…Â¾ Get users (pagination later)
  @Get()
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  findAll() {
    return this.userService.findAll();
  }

  // ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“Ãƒâ€šÃ‚ÂÃƒÆ’Ã‚Â¯Ãƒâ€šÃ‚Â¸Ãƒâ€šÃ‚Â Update profile
  @Patch(':id')
  @UseGuards(SupabaseAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  update(@Param('id') id: string, @Body() body: { phone?: string }) {
    return this.userService.update(id, body);
  }
}
