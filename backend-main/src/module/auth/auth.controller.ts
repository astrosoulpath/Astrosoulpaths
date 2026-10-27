import { Body, Controller, Headers, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ContextRateGuard } from '../../common/auth/context-rate.guard';
import { AuthService } from './auth.service';
import { SmsRoutingService } from './sms-routing.service';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { FirebasePhoneLoginDto } from './dto/firebase-phone-login.dto';
import { FirebaseEmailLoginDto } from './dto/firebase-email-login.dto';
import { RefreshSessionDto } from './dto/refresh-session.dto';
import { SendEmailOtpDto } from './dto/send-email-otp.dto';
import { VerifyEmailOtpDto } from './dto/verify-email-otp.dto';
import { EmailLoginDto } from './dto/email-login.dto';
import { EmailSignupDto } from './dto/email-signup.dto';
import { LinkGooglePhoneDto } from './dto/link-google-phone.dto';
import { LinkFirebaseEmailPhoneDto } from './dto/link-firebase-email-phone.dto';
import { FirebaseGoogleLoginDto } from './dto/firebase-google-login.dto';
import { FirebaseAdminGoogleLoginDto } from './dto/firebase-admin-google-login.dto';
import { LinkFirebaseGoogleLegacyDto } from './dto/link-firebase-google-legacy.dto';
import { LinkFirebaseGooglePhoneDto } from './dto/link-firebase-google-phone.dto';
import { LinkFirebaseEmailGoogleDto } from './dto/link-firebase-email-google.dto';
import { Public } from '../../common/decorators/public.decorator';

@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly smsRoutingService: SmsRoutingService,
  ) {}

  /**
   * Supabase Send SMS Hook.
   * +91 -> MSG91
   * non-+91 -> Twilio
   */
  @Post('supabase-sms-hook')
  async supabaseSmsHook(
    @Body() payload: Parameters<SmsRoutingService['deliverSupabaseOtp']>[0],
    @Headers('authorization') authorization?: string,
    @Headers('x-sms-hook-secret') hookSecret?: string,
  ) {
    const receivedSecret =
      hookSecret?.trim() || authorization?.replace(/^Bearer\s+/i, '').trim();

    await this.smsRoutingService.deliverSupabaseOtp(payload, receivedSecret);

    return { success: true };
  }
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

  @Post('email/signup')
  async signupWithEmail(@Body() dto: EmailSignupDto) {
    return this.authService.signupWithEmail(dto);
  }
  @Post('email/login')
  async loginWithEmail(@Body() dto: EmailLoginDto) {
    return this.authService.loginWithEmail(dto.email, dto.password);
  }
  @Post('refresh')
  async refreshSession(@Body() dto: RefreshSessionDto) {
    return this.authService.refreshSession(
      dto.refreshToken,
      dto.portal ?? 'customer',
    );
  }

  @Post('firebase/phone')
  async firebasePhoneLogin(@Body() dto: FirebasePhoneLoginDto) {
    return this.authService.verifyFirebasePhoneToken(
      dto.idToken,
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
  @Post('admin/firebase/google')
  @UseGuards(ContextRateGuard)
  async firebaseAdminGoogleLogin(@Body() dto: FirebaseAdminGoogleLoginDto) {
    return this.authService.loginAdminWithFirebaseGoogle(dto.idToken);
  }
  @Post('admin/firebase/email')
  @UseGuards(ContextRateGuard)
  firebaseAdminEmailLogin(@Body() dto:FirebaseAdminGoogleLoginDto){return this.authService.loginAdminWithFirebaseEmail(dto.idToken);}
  @Post('admin/context/verify')
  @UseGuards(ContextRateGuard)
  verifyAdminContext(@Body() dto:{accessToken:string}){return this.authService.verifyAdminContext(dto?.accessToken);}
  @Post('context/refresh')
  @HttpCode(200)
  @UseGuards(ContextRateGuard)
  refreshContext(@Body() dto:FirebaseGoogleLoginDto){return this.authService.loginFirebaseContext(dto.idToken,dto.portal??'customer',undefined,true);}

  @Post('firebase/google')
  @UseGuards(ContextRateGuard)
  async firebaseGoogleLogin(@Body() dto: FirebaseGoogleLoginDto) {
    return this.authService.loginWithFirebaseGoogle(
      dto.idToken,
      dto.portal ?? 'customer',
    );
  }

  @Post('link/firebase-email-google')
  async linkFirebaseGoogleToEmailAccount(
    @Body() dto: LinkFirebaseEmailGoogleDto,
  ) {
    return this.authService.linkFirebaseGoogleToEmailAccount(
      dto.idToken,
      dto.confirmAccountLink,
    );
  }

  @Post('link/firebase-google-legacy')
  async linkFirebaseGoogleToLegacyAccount(
    @Body() dto: LinkFirebaseGoogleLegacyDto,
  ) {
    return this.authService.linkFirebaseGoogleToLegacyAccount(
      dto.firebaseIdToken,
      dto.legacySupabaseAccessToken,
      dto.confirmAccountLink,
    );
  }

  @Post('link/firebase-google-phone')
  async linkFirebaseGoogleToVerifiedPhone(
    @Body() dto: LinkFirebaseGooglePhoneDto,
  ) {
    return this.authService.linkFirebaseGoogleToVerifiedPhone(
      dto.firebaseGoogleIdToken,
      dto.firebasePhoneIdToken,
      dto.confirmAccountLink,
    );
  }

  @Post('link/google-phone')
  async linkGoogleIdentityToVerifiedPhone(@Body() body: LinkGooglePhoneDto) {
    return this.authService.linkGoogleIdentityToVerifiedPhone(
      body.googleAccessToken,
      body.firebaseIdToken,
      body.confirmAccountLink === true,
    );
  }

  @Post('link/firebase-email-phone')
  async linkFirebaseEmailToVerifiedPhone(
    @Body() body: LinkFirebaseEmailPhoneDto,
  ) {
    return this.authService.linkFirebaseEmailToVerifiedPhone(
      body.firebaseEmailToken,
      body.firebasePhoneToken,
      body.confirmAccountLink === true,
    );
  }

  @Post('firebase/email')
  @UseGuards(ContextRateGuard)
  async firebaseEmailLogin(
    @Body() firebaseEmailLoginDto: FirebaseEmailLoginDto,
  ) {
    return this.authService.verifyFirebaseEmailToken(
      firebaseEmailLoginDto.idToken,
      firebaseEmailLoginDto.portal,
    );
  }
}
