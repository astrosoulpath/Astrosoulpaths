import 'package:flutter/material.dart';
import 'package:country_picker/country_picker.dart';
import '../../../astrologer/presentation/screens/astrologer_registration_screen.dart';
import '../../../astrologer/presentation/screens/astrologer_qualification_screen.dart';
import '../../../astrologer/presentation/screens/astrologer_pending_approval_screen.dart';
import '../../../astrologer/presentation/screens/astrologer_dashboard_screen.dart';
import 'package:flutter/services.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../customer/presentation/screens/customer_shell_screen.dart';
import '../../../astrologers/presentation/screens/astrologer_selection_screen.dart';
import '../../data/auth_api.dart';
import '../../data/auth_portal.dart';
import '../../data/google_auth_service.dart';
import '../../data/auth_session_store.dart';
import 'otp_verification_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({required this.portal, super.key});

  final AuthPortal portal;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _phoneController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  final _authApi = AuthApi();
  final _sessionStore = AuthSessionStore();

  bool _isSendingOtp = false;
  String _selectedPhoneCode = '91';
  String _selectedCountryCode = 'IN';

  @override
  void dispose() {
    _phoneController.dispose();
    _authApi.close();
    super.dispose();
  }

  Future<void> _openCustomerHomeWithFreeChat(
    VerifyOtpResult verifyResult,
  ) async {
    bool startFreeChat = false;

    if (verifyResult.showFreeChatPopup && verifyResult.freeChatEligible) {
      final minutes = verifyResult.freeChatMinutes > 0
          ? verifyResult.freeChatMinutes
          : 1;

      startFreeChat =
          await showDialog<bool>(
            context: context,
            barrierDismissible: false,
            builder: (dialogContext) {
              return Dialog(
                insetPadding: const EdgeInsets.symmetric(
                  horizontal: 18,
                  vertical: 22,
                ),
                backgroundColor: Colors.transparent,
                elevation: 0,
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    maxWidth: 430,
                    maxHeight: MediaQuery.sizeOf(dialogContext).height * 0.84,
                  ),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.fromLTRB(22, 18, 22, 16),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(30),
                      border: Border.all(
                        color: const Color(0xFFFFC857),
                        width: 1.4,
                      ),
                      gradient: const LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [
                          AppColors.surfaceLight,
                          AppColors.surface,
                          AppColors.background,
                        ],
                      ),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x55FFC857),
                          blurRadius: 32,
                          spreadRadius: 1,
                        ),
                        BoxShadow(
                          color: Color(0xAA000000),
                          blurRadius: 45,
                          offset: Offset(0, 20),
                        ),
                      ],
                    ),
                    child: SingleChildScrollView(
                      physics: const BouncingScrollPhysics(),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Icon(
                                Icons.auto_awesome_rounded,
                                color: Color(0xFFFFC857),
                                size: 18,
                              ),
                              Icon(
                                Icons.star_rounded,
                                color: Color(0xFFFFE7A7),
                                size: 16,
                              ),
                            ],
                          ),

                          const SizedBox(height: 2),

                          ShaderMask(
                            shaderCallback: (bounds) {
                              return const LinearGradient(
                                colors: [
                                  Color(0xFFFFF4C6),
                                  Color(0xFFFFC857),
                                  Color(0xFFFFE6A3),
                                ],
                              ).createShader(bounds);
                            },
                            child: const Text(
                              'Congratulations!',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 36,
                                height: 1.05,
                                fontWeight: FontWeight.w900,
                                letterSpacing: -1.2,
                              ),
                            ),
                          ),

                          const SizedBox(height: 14),

                          const Row(
                            children: [
                              Expanded(
                                child: Divider(color: Color(0x55FFC857)),
                              ),
                              Padding(
                                padding: EdgeInsets.symmetric(horizontal: 12),
                                child: Text(
                                  'WELCOME TO',
                                  style: TextStyle(
                                    color: Color(0xFFDCD5E9),
                                    fontSize: 10,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 2.2,
                                  ),
                                ),
                              ),
                              Expanded(
                                child: Divider(color: Color(0x55FFC857)),
                              ),
                            ],
                          ),

                          const SizedBox(height: 8),

                          const Text(
                            'Astro Soul Path',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: Color(0xFFFFD568),
                              fontSize: 29,
                              height: 1,
                              fontWeight: FontWeight.w900,
                              letterSpacing: -0.5,
                            ),
                          ),

                          const SizedBox(height: 22),

                          Stack(
                            alignment: Alignment.center,
                            children: [
                              Container(
                                width: 150,
                                height: 150,
                                decoration: const BoxDecoration(
                                  shape: BoxShape.circle,
                                  gradient: RadialGradient(
                                    colors: [
                                      Color(0x55FFC857),
                                      Color(0x3327154E),
                                      Color(0x00100A20),
                                    ],
                                  ),
                                ),
                              ),
                              Container(
                                width: 116,
                                height: 116,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: AppColors.surface,
                                  border: Border.all(
                                    color: const Color(0xFFFFC857),
                                    width: 1.3,
                                  ),
                                  boxShadow: const [
                                    BoxShadow(
                                      color: Color(0x66FFC857),
                                      blurRadius: 30,
                                    ),
                                  ],
                                ),
                                child: const Icon(
                                  Icons.card_giftcard_rounded,
                                  color: Color(0xFFFFC857),
                                  size: 63,
                                ),
                              ),
                              const Positioned(
                                top: 15,
                                right: 19,
                                child: Icon(
                                  Icons.auto_awesome_rounded,
                                  color: Color(0xFFFFE7A7),
                                  size: 28,
                                ),
                              ),
                              const Positioned(
                                bottom: 20,
                                left: 18,
                                child: Icon(
                                  Icons.star_rounded,
                                  color: Color(0xFFFFC857),
                                  size: 18,
                                ),
                              ),
                            ],
                          ),

                          const SizedBox(height: 18),

                          const Text(
                            "You've unlocked your",
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: Color(0xFFECE7F3),
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),

                          const SizedBox(height: 5),

                          Text(
                            '$minutes MIN FREE CHAT',
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                              color: Color(0xFFFFC857),
                              fontSize: 28,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 0.6,
                            ),
                          ),

                          const SizedBox(height: 5),

                          const Text(
                            'with a trusted astrologer',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: Color(0xFFE6DFEE),
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),

                          const SizedBox(height: 18),

                          Container(
                            width: double.infinity,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 12,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0x14FFC857),
                              borderRadius: BorderRadius.circular(18),
                              border: Border.all(
                                color: const Color(0x33FFC857),
                              ),
                            ),
                            child: const Row(
                              children: [
                                SizedBox(
                                  width: 42,
                                  height: 42,
                                  child: DecoratedBox(
                                    decoration: BoxDecoration(
                                      color: Color(0x1FFFC857),
                                      shape: BoxShape.circle,
                                    ),
                                    child: Icon(
                                      Icons.chat_bubble_rounded,
                                      color: Color(0xFFFFC857),
                                      size: 20,
                                    ),
                                  ),
                                ),
                                SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                    'Ask your questions, get clarity and guidance instantly.',
                                    style: TextStyle(
                                      color: Color(0xFFF0EBF5),
                                      fontSize: 13,
                                      height: 1.35,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                                SizedBox(width: 8),
                                Icon(
                                  Icons.auto_awesome_rounded,
                                  color: Color(0xFFFFC857),
                                  size: 21,
                                ),
                              ],
                            ),
                          ),

                          const SizedBox(height: 18),

                          SizedBox(
                            width: double.infinity,
                            height: 58,
                            child: FilledButton(
                              onPressed: () =>
                                  Navigator.of(dialogContext).pop(true),
                              style: FilledButton.styleFrom(
                                backgroundColor: const Color(0xFFFFC857),
                                foregroundColor: const Color(0xFF241700),
                                elevation: 7,
                                shadowColor: const Color(0x77FFC857),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(19),
                                ),
                              ),
                              child: const Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Text(
                                    'Start Free Chat',
                                    style: TextStyle(
                                      fontSize: 17,
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                  SizedBox(width: 10),
                                  Icon(Icons.arrow_forward_rounded, size: 22),
                                ],
                              ),
                            ),
                          ),

                          const SizedBox(height: 6),

                          TextButton(
                            onPressed: () =>
                                Navigator.of(dialogContext).pop(false),
                            child: const Text(
                              'Maybe Later',
                              style: TextStyle(
                                color: Color(0xFFB6A5D2),
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            },
          ) ??
          false;
    }

    if (!mounted) {
      return;
    }

    final navigator = Navigator.of(context);

    navigator.pushAndRemoveUntil(
      MaterialPageRoute<void>(builder: (_) => const CustomerShellScreen()),
      (route) => false,
    );

    if (startFreeChat) {
      navigator.push(
        MaterialPageRoute<void>(
          builder: (_) => AstrologerSelectionScreen(
            isFreeChatIntent: true,
            freeChatMinutes: verifyResult.freeChatMinutes > 0
                ? verifyResult.freeChatMinutes
                : 1,
          ),
        ),
      );
    }
  }

  void _openCountryPicker() {
    FocusScope.of(context).unfocus();

    showCountryPicker(
      context: context,
      showPhoneCode: true,
      favorite: const <String>['IN', 'US', 'GB', 'AE', 'CA', 'AU'],
      onSelect: (country) {
        if (!mounted) {
          return;
        }

        setState(() {
          _selectedPhoneCode = country.phoneCode;
          _selectedCountryCode = country.countryCode;
        });
      },
    );
  }

  Future<void> _continueWithPhone() async {
    FocusScope.of(context).unfocus();

    if (!_formKey.currentState!.validate() || _isSendingOtp) {
      return;
    }

    setState(() {
      _isSendingOtp = true;
    });

    final localNumber = _phoneController.text.trim();
    final phone = '+$_selectedPhoneCode$localNumber';

    try {
      final sendResult = await _authApi.sendOtp(
        phone: phone,
        portal: widget.portal,
      );

      if (!mounted) {
        return;
      }

      final verifyResult = await Navigator.of(context).push<VerifyOtpResult>(
        MaterialPageRoute(
          builder: (_) => OtpVerificationScreen(
            phone: phone,
            portal: widget.portal,
            devOtp: sendResult.devOtp,
          ),
        ),
      );

      if (!mounted || verifyResult == null) {
        return;
      }

      if (widget.portal == AuthPortal.astrologer) {
        if (verifyResult.nextStep == 'OPEN_ASTROLOGER_DASHBOARD') {
          Navigator.of(context).pushAndRemoveUntil(
            MaterialPageRoute<void>(
              builder: (_) => const AstrologerDashboardScreen(),
            ),
            (route) => false,
          );

          return;
        }

        if (verifyResult.nextStep == 'WAIT_FOR_ADMIN_APPROVAL') {
          Navigator.of(context).pushAndRemoveUntil(
            MaterialPageRoute<void>(
              builder: (_) => AstrologerPendingApprovalScreen(
                message: verifyResult.message,
              ),
            ),
            (route) => false,
          );

          return;
        }

        if (verifyResult.nextStep == 'COMPLETE_ASTROLOGER_ONBOARDING') {
          final qualificationPassed = await Navigator.of(context).push<bool>(
            MaterialPageRoute<bool>(
              builder: (_) => AstrologerQualificationScreen(
                accessToken: verifyResult.accessToken,
              ),
            ),
          );

          if (!mounted || qualificationPassed != true) {
            return;
          }

          Navigator.of(context).pushAndRemoveUntil(
            MaterialPageRoute<void>(
              builder: (_) => AstrologerRegistrationScreen(
                phone: phone,
                accessToken: verifyResult.accessToken,
              ),
            ),
            (route) => false,
          );

          return;
        }
      }

      if (widget.portal == AuthPortal.joinAstrologer) {
        if (verifyResult.nextStep == 'COMPLETE_ASTROLOGER_ONBOARDING' ||
            verifyResult.nextStep == 'OPEN_ASTROLOGER_DASHBOARD') {
          final qualificationPassed = await Navigator.of(context).push<bool>(
            MaterialPageRoute<bool>(
              builder: (_) => AstrologerQualificationScreen(
                accessToken: verifyResult.accessToken,
              ),
            ),
          );

          if (!mounted || qualificationPassed != true) {
            return;
          }

          Navigator.of(context).pushAndRemoveUntil(
            MaterialPageRoute<void>(
              builder: (_) => AstrologerRegistrationScreen(
                phone: phone,
                accessToken: verifyResult.accessToken,
              ),
            ),
            (route) => false,
          );

          return;
        }

        if (verifyResult.nextStep == 'WAIT_FOR_ADMIN_APPROVAL') {
          Navigator.of(context).pushAndRemoveUntil(
            MaterialPageRoute<void>(
              builder: (_) => AstrologerPendingApprovalScreen(
                message: verifyResult.message,
              ),
            ),
            (route) => false,
          );

          return;
        }
      }
      if (verifyResult.role == 'CUSTOMER' &&
          verifyResult.nextStep == 'OPEN_HOME') {
        await _openCustomerHomeWithFreeChat(verifyResult);
        return;
      }

      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(
          SnackBar(
            content: Text('${verifyResult.message} - ${verifyResult.nextStep}'),
            backgroundColor: Colors.green.shade700,
          ),
        );
    } on AuthApiException catch (error) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(
          SnackBar(
            content: Text(error.message),
            backgroundColor: Colors.red.shade700,
          ),
        );
    } finally {
      if (mounted) {
        setState(() {
          _isSendingOtp = false;
        });
      }
    }
  }

  Future<void> _continueWithGoogle() async {
    FocusScope.of(context).unfocus();

    if (_isSendingOtp) {
      return;
    }

    setState(() {
      _isSendingOtp = true;
    });

    try {
      final googleResult = await GoogleAuthService.instance.signIn();
      final supabaseSession = googleResult.session;

      final verifyResult = await _authApi.googleLogin(
        accessToken: supabaseSession.accessToken,
        refreshToken: supabaseSession.refreshToken ?? '',
        expiresIn: supabaseSession.expiresIn ?? 0,
        portal: widget.portal,
      );

      await _sessionStore.save(verifyResult);

      if (!mounted) {
        return;
      }

      switch (widget.portal) {
        case AuthPortal.customer:
          if (verifyResult.role != 'CUSTOMER' ||
              verifyResult.portal != 'customer') {
            throw const AuthApiException(
              'This Google account is not authorized for customer login.',
            );
          }

          await _openCustomerHomeWithFreeChat(verifyResult);
          return;

        case AuthPortal.astrologer:
          if (verifyResult.role != 'ASTROLOGER' ||
              verifyResult.portal != 'astrologer') {
            throw const AuthApiException(
              'This Google account is not authorized for astrologer login.',
            );
          }

          if (verifyResult.nextStep == 'OPEN_ASTROLOGER_DASHBOARD') {
            Navigator.of(context).pushAndRemoveUntil(
              MaterialPageRoute<void>(
                builder: (_) => const AstrologerDashboardScreen(),
              ),
              (route) => false,
            );
            return;
          }

          if (verifyResult.nextStep == 'WAIT_FOR_ADMIN_APPROVAL') {
            Navigator.of(context).pushAndRemoveUntil(
              MaterialPageRoute<void>(
                builder: (_) => AstrologerPendingApprovalScreen(
                  message: verifyResult.message,
                ),
              ),
              (route) => false,
            );
            return;
          }

          if (verifyResult.nextStep == 'COMPLETE_ASTROLOGER_ONBOARDING' ||
              verifyResult.nextStep == 'OPEN_ASTROLOGER_DASHBOARD') {
            ScaffoldMessenger.of(context)
              ..clearSnackBars()
              ..showSnackBar(
                const SnackBar(
                  content: Text(
                    'Complete your astrologer onboarding from Join as Astrologer.',
                  ),
                ),
              );
            return;
          }

          throw AuthApiException(
            'Unsupported astrologer login state: ${verifyResult.nextStep}',
          );

        case AuthPortal.joinAstrologer:
          if (verifyResult.role != 'ASTROLOGER_APPLICANT' ||
              verifyResult.portal != 'joinAstrologer') {
            throw const AuthApiException(
              'This Google account cannot continue astrologer onboarding.',
            );
          }

          if (verifyResult.nextStep ==
              'VERIFY_MOBILE_FOR_ASTROLOGER_ONBOARDING') {
            ScaffoldMessenger.of(context)
              ..clearSnackBars()
              ..showSnackBar(SnackBar(content: Text(verifyResult.message)));
            return;
          }

          if (verifyResult.nextStep == 'WAIT_FOR_ADMIN_APPROVAL') {
            Navigator.of(context).pushAndRemoveUntil(
              MaterialPageRoute<void>(
                builder: (_) => AstrologerPendingApprovalScreen(
                  message: verifyResult.message,
                ),
              ),
              (route) => false,
            );
            return;
          }

          if (verifyResult.nextStep == 'COMPLETE_ASTROLOGER_ONBOARDING' ||
              verifyResult.nextStep == 'OPEN_ASTROLOGER_DASHBOARD') {
            final googlePhone =
                verifyResult.user['phone']?.toString().trim() ?? '';

            if (googlePhone.isEmpty) {
              ScaffoldMessenger.of(context)
                ..clearSnackBars()
                ..showSnackBar(
                  const SnackBar(
                    content: Text(
                      'Verify your mobile number before continuing astrologer onboarding.',
                    ),
                  ),
                );
              return;
            }

            final qualificationPassed = await Navigator.of(context).push<bool>(
              MaterialPageRoute<bool>(
                builder: (_) => AstrologerQualificationScreen(
                  accessToken: verifyResult.accessToken,
                ),
              ),
            );

            if (!mounted || qualificationPassed != true) {
              return;
            }

            Navigator.of(context).pushAndRemoveUntil(
              MaterialPageRoute<void>(
                builder: (_) => AstrologerRegistrationScreen(
                  phone: googlePhone,
                  accessToken: verifyResult.accessToken,
                ),
              ),
              (route) => false,
            );
            return;
          }

          throw AuthApiException(
            'Unsupported astrologer onboarding state: ${verifyResult.nextStep}',
          );
      }
    } on GoogleAuthCancelledException {
      return;
    } on GoogleAuthException catch (error) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(
          SnackBar(
            content: Text(error.message),
            backgroundColor: Colors.red.shade700,
          ),
        );
    } on AuthApiException catch (error) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(
          SnackBar(
            content: Text(error.message),
            backgroundColor: Colors.red.shade700,
          ),
        );
    } finally {
      if (mounted) {
        setState(() {
          _isSendingOtp = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final portal = widget.portal;

    return Scaffold(
      body: DecoratedBox(
        decoration: const BoxDecoration(
          gradient: RadialGradient(
            center: Alignment.topCenter,
            radius: 1.2,
            colors: [AppColors.surfaceLight, AppColors.background],
          ),
        ),
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Align(
                    alignment: Alignment.centerLeft,
                    child: IconButton(
                      onPressed: Navigator.of(context).pop,
                      style: IconButton.styleFrom(
                        backgroundColor: AppColors.surface,
                      ),
                      icon: const Icon(
                        Icons.arrow_back_rounded,
                        color: AppColors.gold,
                      ),
                    ),
                  ),
                  const SizedBox(height: 22),
                  Container(
                    width: 104,
                    height: 104,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.surface,
                      border: Border.all(color: AppColors.gold, width: 2),
                      boxShadow: const [
                        BoxShadow(color: Color(0x44F4C45E), blurRadius: 24),
                      ],
                    ),
                    child: ClipOval(
                      child: Image.asset(
                        'assets/branding/login_deity.png',
                        width: 96,
                        height: 96,
                        fit: BoxFit.cover,
                        errorBuilder: (_, _, _) => const Icon(
                          Icons.auto_awesome_rounded,
                          color: AppColors.gold,
                          size: 36,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  Text(
                    portal.eyebrow,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: AppColors.gold,
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.6,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    portal.title,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineMedium,
                  ),
                  const SizedBox(height: 10),
                  Text(
                    portal.subtitle,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 30),
                  Container(
                    padding: const EdgeInsets.fromLTRB(20, 24, 20, 22),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(26),
                      border: Border.all(color: const Color(0x557A8BB8)),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x55000000),
                          blurRadius: 28,
                          offset: Offset(0, 14),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const Text(
                          'Mobile Number',
                          style: TextStyle(
                            color: AppColors.white,
                            fontSize: 13,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        const SizedBox(height: 10),

                        TextFormField(
                          controller: _phoneController,
                          keyboardType: TextInputType.phone,
                          maxLength: 10,
                          inputFormatters: [
                            FilteringTextInputFormatter.digitsOnly,
                          ],
                          style: const TextStyle(
                            color: AppColors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                          ),
                          decoration: InputDecoration(
                            counterText: '',
                            hintText: 'Enter mobile number',
                            hintStyle: const TextStyle(
                              color: Color(0xFF65708E),
                            ),
                            prefixIconConstraints: const BoxConstraints(
                              minWidth: 74,
                            ),
                            prefixIcon: InkWell(
                              onTap: _openCountryPicker,
                              borderRadius: BorderRadius.circular(12),
                              child: Padding(
                                padding: const EdgeInsets.only(
                                  left: 14,
                                  right: 8,
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Text(
                                      _selectedCountryCode,
                                      style: const TextStyle(fontSize: 20),
                                    ),
                                    const SizedBox(width: 6),
                                    Text(
                                      '+$_selectedPhoneCode',
                                      style: const TextStyle(
                                        color: AppColors.white,
                                        fontWeight: FontWeight.w900,
                                      ),
                                    ),
                                    const SizedBox(width: 3),
                                    const Icon(
                                      Icons.keyboard_arrow_down_rounded,
                                      color: AppColors.gold,
                                      size: 19,
                                    ),
                                    const SizedBox(width: 8),
                                    const SizedBox(
                                      height: 26,
                                      child: VerticalDivider(
                                        color: Color(0x557A8BB8),
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                  ],
                                ),
                              ),
                            ),
                            filled: true,
                            fillColor: AppColors.surfaceLight,
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(16),
                              borderSide: BorderSide.none,
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(16),
                              borderSide: const BorderSide(
                                color: Color(0x667A8BB8),
                              ),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(16),
                              borderSide: const BorderSide(
                                color: AppColors.gold,
                                width: 1.5,
                              ),
                            ),
                          ),
                          validator: (value) {
                            if (value == null || value.length != 10) {
                              return 'Enter a valid 10-digit mobile number';
                            }

                            return null;
                          },
                        ),

                        const SizedBox(height: 18),

                        FilledButton(
                          onPressed: _isSendingOtp ? null : _continueWithPhone,
                          style: FilledButton.styleFrom(
                            backgroundColor: AppColors.gold,
                            foregroundColor: AppColors.background,
                            minimumSize: const Size.fromHeight(56),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                            ),
                          ),
                          child: _isSendingOtp
                              ? const SizedBox(
                                  width: 22,
                                  height: 22,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2.5,
                                  ),
                                )
                              : Text(
                                  portal.actionLabel,
                                  style: const TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                        ),

                        if (portal == AuthPortal.customer ||
                            portal == AuthPortal.astrologer ||
                            portal == AuthPortal.joinAstrologer) ...[
                          const SizedBox(height: 24),
                          const Row(
                            children: [
                              Expanded(
                                child: Divider(color: Color(0x557A8BB8)),
                              ),
                              Padding(
                                padding: EdgeInsets.symmetric(horizontal: 14),
                                child: Text(
                                  'OR',
                                  style: TextStyle(
                                    color: AppColors.muted,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ),
                              Expanded(
                                child: Divider(color: Color(0x557A8BB8)),
                              ),
                            ],
                          ),
                          const SizedBox(height: 18),

                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              _SocialLoginButton(
                                label: 'G',
                                tooltip: 'Continue with Google',
                                onTap: _continueWithGoogle,
                              ),
                              const SizedBox(width: 18),
                              const _AppleVisualLoginButton(),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 22),
                  const Text(
                    'Your account is protected with secure OTP verification.',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Color(0xFF75809B), fontSize: 11),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SocialLoginButton extends StatelessWidget {
  const _SocialLoginButton({
    required this.label,
    required this.tooltip,
    required this.onTap,
  });

  final String label;
  final String tooltip;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: AppColors.white,
        shape: const CircleBorder(),
        child: InkWell(
          onTap: onTap,
          customBorder: const CircleBorder(),
          child: SizedBox(
            width: 58,
            height: 58,
            child: Center(
              child: Text(
                label,
                style: const TextStyle(
                  color: AppColors.background,
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _AppleVisualLoginButton extends StatelessWidget {
  const _AppleVisualLoginButton();

  @override
  Widget build(BuildContext context) {
    return const Tooltip(
      message: 'Continue with Apple',
      child: Material(
        color: AppColors.white,
        shape: CircleBorder(),
        child: SizedBox(
          width: 58,
          height: 58,
          child: Center(
            child: Icon(Icons.apple, color: AppColors.background, size: 29),
          ),
        ),
      ),
    );
  }
}
