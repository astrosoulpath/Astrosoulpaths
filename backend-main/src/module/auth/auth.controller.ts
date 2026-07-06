import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
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
}
