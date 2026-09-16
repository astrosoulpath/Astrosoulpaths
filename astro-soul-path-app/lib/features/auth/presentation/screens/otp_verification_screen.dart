import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../../core/notifications/notification_service.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../customer/presentation/screens/customer_birth_onboarding_screen.dart';
import '../../../profile/data/profile_api.dart';
import '../../data/auth_api.dart';
import '../../data/auth_portal.dart';
import '../../data/auth_session_store.dart';

class OtpVerificationScreen extends StatefulWidget {
  const OtpVerificationScreen({
    required this.phone,
    required this.portal,
    this.devOtp,
    super.key,
  });

  final String phone;
  final AuthPortal portal;
  final String? devOtp;

  @override
  State<OtpVerificationScreen> createState() => _OtpVerificationScreenState();
}

class _OtpVerificationScreenState extends State<OtpVerificationScreen> {
  final _otpController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  final _authApi = AuthApi();
  final _sessionStore = AuthSessionStore();

  bool _isVerifying = false;
  bool _isResending = false;
  int _resendSeconds = 60;
  Timer? _resendTimer;
  String? _devOtp;

  @override
  void initState() {
    super.initState();
    _devOtp = widget.devOtp;
    _startResendCooldown();
  }

  void _startResendCooldown() {
    _resendTimer?.cancel();

    setState(() {
      _resendSeconds = 60;
    });

    _resendTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }

      if (_resendSeconds <= 1) {
        timer.cancel();

        setState(() {
          _resendSeconds = 0;
        });

        return;
      }

      setState(() {
        _resendSeconds--;
      });
    });
  }

  @override
  void dispose() {
    _resendTimer?.cancel();
    _otpController.dispose();
    _authApi.close();
    super.dispose();
  }

  Future<void> _verifyOtp() async {
    FocusScope.of(context).unfocus();

    if (!_formKey.currentState!.validate() || _isVerifying) {
      return;
    }

    setState(() {
      _isVerifying = true;
    });

    try {
      final result = await _authApi.verifyOtp(
        phone: widget.phone,
        otp: _otpController.text.trim(),
        portal: widget.portal,
      );

      await _sessionStore.save(result);

      // Session now exists, so register the current FCM device.
      // Failure inside syncCurrentDevice never blocks login.
      await NotificationService.instance.syncCurrentDevice();

      if (!mounted) {
        return;
      }

      // ------------------------------------------------------
      // ASP CUSTOMER PREMIUM PROFILE GATE
      // CUSTOMER only - astrologer flows remain untouched.
      // ------------------------------------------------------
      if (widget.portal == AuthPortal.customer) {
        final profileApi = ProfileApi();

        try {
          final profiles = await profileApi.getProfiles();

          if (!mounted) {
            return;
          }

          final existingProfile = profiles.isEmpty ? null : profiles.first;

          final serverProfileComplete =
              result.user['isProfileComplete'] == true;

          final profileHasRequiredData =
              existingProfile != null &&
              (existingProfile.fullName ?? existingProfile.name)
                  .trim()
                  .isNotEmpty &&
              existingProfile.city?.trim().isNotEmpty == true &&
              existingProfile.countryCode?.trim().isNotEmpty == true &&
              existingProfile.gender.trim().isNotEmpty &&
              (!existingProfile.birthTimeKnown ||
                  existingProfile.birthTime.trim().isNotEmpty) &&
              existingProfile.timezoneName?.trim().isNotEmpty == true;

          if (!serverProfileComplete || !profileHasRequiredData) {
            final completed = await Navigator.of(context).push<bool>(
              MaterialPageRoute<bool>(
                builder: (_) => CustomerBirthOnboardingScreen(
                  existingProfile: existingProfile,
                ),
              ),
            );

            if (!mounted) {
              return;
            }

            if (completed != true) {
              return;
            }
          }
        } on ProfileApiException catch (error) {
          if (!mounted) {
            return;
          }

          ScaffoldMessenger.of(context)
            ..clearSnackBars()
            ..showSnackBar(
              SnackBar(
                content: Text(error.message),
                backgroundColor: Colors.red,
              ),
            );

          return;
        } finally {
          profileApi.close();
        }
      }

      if (!mounted) {
        return;
      }

      Navigator.of(context).pop(result);
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
          _isVerifying = false;
        });
      }
    }
  }

  Future<void> _resendOtp() async {
    if (_isResending || _isVerifying || _resendSeconds > 0) {
      return;
    }

    setState(() {
      _isResending = true;
    });

    try {
      final result = await _authApi.sendOtp(
        phone: widget.phone,
        portal: widget.portal,
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _devOtp = result.devOtp;
        _otpController.clear();
      });

      _startResendCooldown();

      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(SnackBar(content: Text(result.message)));
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
          _isResending = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
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
                      onPressed: _isVerifying
                          ? null
                          : Navigator.of(context).pop,
                      style: IconButton.styleFrom(
                        backgroundColor: AppColors.surface,
                      ),
                      icon: const Icon(
                        Icons.arrow_back_rounded,
                        color: AppColors.gold,
                      ),
                    ),
                  ),
                  const SizedBox(height: 28),
                  const Icon(
                    Icons.mark_email_read_rounded,
                    color: AppColors.gold,
                    size: 72,
                  ),
                  const SizedBox(height: 24),
                  Text(
                    'VERIFY MOBILE NUMBER',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: AppColors.gold,
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.5,
                    ),
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'Enter your secure OTP',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineMedium,
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'OTP sent to ${widget.phone}',
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 30),
                  Container(
                    padding: const EdgeInsets.all(22),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: const Color(0x667A8BB8)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (_devOtp != null) ...[
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: const Color(0x2234C759),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: const Color(0x6634C759),
                              ),
                            ),
                            child: Text(
                              'Local development OTP: $_devOtp',
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                color: Color(0xFF7FE39A),
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                          const SizedBox(height: 18),
                        ],
                        TextFormField(
                          controller: _otpController,
                          autofocus: true,
                          keyboardType: TextInputType.number,
                          textAlign: TextAlign.center,
                          maxLength: 8,
                          inputFormatters: [
                            FilteringTextInputFormatter.digitsOnly,
                          ],
                          style: const TextStyle(
                            color: AppColors.white,
                            fontSize: 26,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 8,
                          ),
                          decoration: InputDecoration(
                            counterText: '',
                            hintText: '------',
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
                            final otp = value?.trim() ?? '';

                            if (!RegExp(r'^\d{4,8}$').hasMatch(otp)) {
                              return 'Enter the 4 to 8 digit OTP';
                            }

                            return null;
                          },
                          onFieldSubmitted: (_) => _verifyOtp(),
                        ),
                        const SizedBox(height: 18),
                        FilledButton(
                          onPressed: _isVerifying ? null : _verifyOtp,
                          style: FilledButton.styleFrom(
                            backgroundColor: AppColors.gold,
                            foregroundColor: AppColors.background,
                            minimumSize: const Size.fromHeight(56),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(16),
                            ),
                          ),
                          child: _isVerifying
                              ? const SizedBox(
                                  width: 22,
                                  height: 22,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2.5,
                                  ),
                                )
                              : const Text(
                                  'Verify OTP',
                                  style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                        ),
                        const SizedBox(height: 10),
                        TextButton(
                          onPressed:
                              _isResending || _isVerifying || _resendSeconds > 0
                              ? null
                              : _resendOtp,
                          child: Text(
                            _isResending
                                ? 'Sending OTP...'
                                : _resendSeconds > 0
                                ? 'Resend OTP in ${_resendSeconds}s'
                                : 'Resend OTP',
                          ),
                        ),
                      ],
                    ),
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

