import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { RefreshSessionDto } from './dto/refresh-session.dto';
import { SendEmailOtpDto } from './dto/send-email-otp.dto';
import { VerifyEmailOtpDto } from './dto/verify-email-otp.dto';
import { Public } from '../../common/decorators/public.decorator';

@Public()
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Endpoint to send OTP
  @Post('send-otp')
  async sendOtp(@Body() sendOtpDto: SendOtpDto) {
    return this.authService.sendOtp(sendOtpDto.phone);
  }

  @Post('astrologer/send-otp')
  async sendAstrologerOtp(@Body() sendOtpDto: SendOtpDto) {
    return this.authService.sendAstrologerOtp(sendOtpDto.phone);
  }

  @Post('join-astrologer/send-otp')
  async sendJoinAstrologerOtp(@Body() sendOtpDto: SendOtpDto) {
    return this.authService.sendJoinAstrologerOtp(sendOtpDto.phone);
  }

  @Post('admin/send-otp')
  async sendAdminOtp(@Body() sendOtpDto: SendOtpDto) {
    return this.authService.sendAdminOtp(sendOtpDto.phone);
  }

  //Endpoint to verify OTP
  @Post('verify-otp')
  async verifyOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyOtp(verifyOtpDto.phone, verifyOtpDto.token);
  }

  @Post('astrologer/verify-otp')
  async verifyAstrologerOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyAstrologerOtp(
      verifyOtpDto.phone,
      verifyOtpDto.token,
    );
  }
  @Post('join-astrologer/verify-otp')
  async verifyJoinAstrologerOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyJoinAstrologerOtp(
      verifyOtpDto.phone,
      verifyOtpDto.token,
    );
  }

  @Post('admin/verify-otp')
  async verifyAdminOtp(@Body() verifyOtpDto: VerifyOtpDto) {
    return this.authService.verifyAdminOtp(
      verifyOtpDto.phone,
      verifyOtpDto.token,
    );
  }

  @Post('email/send-otp')
  async sendEmailOtp(@Body() dto: SendEmailOtpDto) {
    return this.authService.sendEmailOtp(dto.email);
  }

  @Post('email/verify-otp')
  async verifyEmailOtp(@Body() dto: VerifyEmailOtpDto) {
    return this.authService.verifyEmailOtp(dto.email, dto.token);
  }
  @Post('refresh')
  async refreshSession(@Body() dto: RefreshSessionDto) {
    return this.authService.refreshSession(
      dto.refreshToken,
      dto.portal ?? 'customer',
    );
  }
  @Post('google')
  async googleLogin(@Body() dto: GoogleLoginDto) {
    return this.authService.loginWithGoogle(
      dto.accessToken,
      dto.portal ?? 'customer',
    );
  }
}
