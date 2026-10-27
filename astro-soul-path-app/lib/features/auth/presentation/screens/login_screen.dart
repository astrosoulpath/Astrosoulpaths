import '../widgets/celestial_login_layout.dart';
import '../../../astrologer/presentation/screens/astrologer_application_screen.dart';
import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:country_picker/country_picker.dart';
import '../../../astrologer/presentation/screens/astrologer_registration_screen.dart';
import '../../../astrologer/presentation/screens/astrologer_pending_approval_screen.dart';
import '../../../astrologer/presentation/screens/astrologer_dashboard_screen.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../customer/presentation/screens/customer_shell_screen.dart';
import '../../../astrologers/presentation/screens/astrologer_selection_screen.dart';
import '../../data/auth_api.dart';
import '../../data/firebase_phone_auth_service.dart';
import '../../data/auth_portal.dart';
import '../../data/google_auth_service.dart';
import '../../data/auth_session_store.dart';
import '../../data/customer_onboarding_flow.dart';
import '../../../profile/data/profile_api.dart';
import '../../../customer/presentation/screens/customer_birth_onboarding_screen.dart';
import '../../data/phone_otp_send_cooldown.dart';
import 'otp_verification_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({
    required this.portal,
    this.emailAuth,
    this.authApi,
    this.sessionStore,
    this.googleSignIn,
    this.firebaseUidReader,
    super.key,
  });

  final AuthPortal portal;
  final FirebaseAuth? emailAuth;
  final AuthApi? authApi;
  final AuthSessionStore? sessionStore;
  final Future<GoogleAuthResult> Function()? googleSignIn;
  final String? Function()? firebaseUidReader;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _phoneController = TextEditingController();
  final _formKey = GlobalKey<FormState>();
  late final _authApi = widget.authApi ?? AuthApi();
  late final _sessionStore = widget.sessionStore ?? AuthSessionStore();

  bool _isSendingOtp = false;
  String _selectedPhoneCode = '91';

  @override
  void dispose() {
    _phoneController.dispose();
    _authApi.close();
    super.dispose();
  }

  Future<void> _openCustomerHomeWithFreeChat(
    VerifyOtpResult verifyResult,
  ) async {
    final profiles = ProfileApi();
    try {
      final completed = await completeCustomerOnboarding(
        sessions: _sessionStore,
        loadProfiles: profiles.getProfiles,
        showForm: (profile) async {
          if (!mounted) return false;
          return Navigator.of(context).push<bool>(
            MaterialPageRoute(
              builder: (_) =>
                  CustomerBirthOnboardingScreen(existingProfile: profile),
            ),
          );
        },
      );
      if (!mounted || !completed) return;
    } finally {
      profiles.close();
    }
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
                              color: Color(0xFF51415F),
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
                              color: Color(0xFF685675),
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
                                      color: Color(0xFF4D3F59),
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

  // Retained for phone authentication/linking compatibility; hidden from entry UI.
  // ignore: unused_element
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
        });
      },
    );
  }

  // Retained phone-login implementation; entry UI offers Google/Email only.
  // ignore: unused_element
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
      String? firebaseVerificationId;
      int? firebaseResendToken;
      String? devOtp;

      final firebaseCode = await FirebasePhoneAuthService.instance.sendCode(
        phone: phone,
      );

      firebaseVerificationId = firebaseCode.verificationId;
      firebaseResendToken = firebaseCode.resendToken;

      if (!mounted) {
        return;
      }

      final verifyResult = await Navigator.of(context).push<VerifyOtpResult>(
        MaterialPageRoute(
          builder: (_) => OtpVerificationScreen(
            phone: phone,
            portal: widget.portal,
            devOtp: devOtp,
            firebaseVerificationId: firebaseVerificationId,
            firebaseResendToken: firebaseResendToken,
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
        Navigator.of(context).pushReplacement(
          MaterialPageRoute<void>(
            builder: (_) => const AstrologerApplicationScreen(),
          ),
        );
        return;
      }
      // CUSTOMER PHONE/OTP SUCCESS:
      // OTP screen has already completed required customer onboarding
      // before returning VerifyOtpResult here.
      if (widget.portal == AuthPortal.customer &&
          verifyResult.role == 'CUSTOMER' &&
          verifyResult.portal == 'customer') {
        await _sessionStore.save(verifyResult);

        if (!mounted) {
          return;
        }

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
    } on FirebaseException catch (error) {
      if (!mounted) {
        return;
      }

      final message = phoneOtpWaitMessage(
        error,
        'Unable to send a verification code. Please try again.',
      );

      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(
          SnackBar(
            content: Text(message),
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

  Future<void> _continueWithEmailPassword() async {
    if (_isSendingOtp) return;
    setState(() {
      _isSendingOtp = true;
    });
    try {
      await _performEmailFlow();
    } finally {
      if (mounted) {
        setState(() {
          _isSendingOtp = false;
        });
      }
    }
  }

  Future<void> _performEmailFlow() async {
    final emailController = TextEditingController();
    final passwordController = TextEditingController();
    final formKey = GlobalKey<FormState>();
    var obscurePassword = true;
    var signup = false;

    final credentials = await showDialog<Map<String, String>>(
      context: context,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: AppColors.surface,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(24),
                side: const BorderSide(color: Color(0x557A8BB8)),
              ),
              title: const Text(
                'Continue with Email',
                style: TextStyle(
                  color: AppColors.white,
                  fontWeight: FontWeight.w800,
                ),
              ),
              content: Form(
                key: formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextFormField(
                      controller: emailController,
                      keyboardType: TextInputType.emailAddress,
                      autofillHints: const [AutofillHints.email],
                      style: const TextStyle(color: AppColors.white),
                      decoration: const InputDecoration(
                        labelText: 'Email address',
                        prefixIcon: Icon(Icons.email_outlined),
                      ),
                      validator: (value) {
                        final email = value?.trim() ?? '';

                        if (email.isEmpty ||
                            !RegExp(
                              r'^[^@\s]+@[^@\s]+\.[^@\s]+$',
                            ).hasMatch(email)) {
                          return 'Enter a valid email address';
                        }

                        return null;
                      },
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: passwordController,
                      obscureText: obscurePassword,
                      autofillHints: const [AutofillHints.password],
                      style: const TextStyle(color: AppColors.white),
                      decoration: InputDecoration(
                        labelText: 'Password',
                        prefixIcon: const Icon(Icons.lock_outline_rounded),
                        suffixIcon: IconButton(
                          onPressed: () {
                            setDialogState(() {
                              obscurePassword = !obscurePassword;
                            });
                          },
                          icon: Icon(
                            obscurePassword
                                ? Icons.visibility_outlined
                                : Icons.visibility_off_outlined,
                          ),
                        ),
                      ),
                      validator: (value) {
                        if ((value ?? '').isEmpty ||
                            (signup && (value ?? '').length < 8)) {
                          return signup
                              ? 'Use at least 8 characters'
                              : 'Enter your password';
                        }
                        return null;
                      },
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => setDialogState(() {
                    signup = !signup;
                  }),
                  child: Text(
                    signup
                        ? 'Already have an account? Sign In'
                        : 'Create Account',
                  ),
                ),
                TextButton(
                  onPressed: () {
                    final email = emailController.text.trim();
                    if (!RegExp(
                      r'^[^@\s]+@[^@\s]+\.[^@\s]+$',
                    ).hasMatch(email)) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Enter a valid email address first.'),
                        ),
                      );
                      return;
                    }
                    Navigator.of(
                      dialogContext,
                    ).pop({'email': email, 'action': 'reset'});
                  },
                  child: const Text('Forgot Password?'),
                ),
                TextButton(
                  onPressed: () {
                    if (!formKey.currentState!.validate()) return;
                    Navigator.of(dialogContext).pop({
                      'email': emailController.text.trim(),
                      'password': passwordController.text,
                      'action': 'resend',
                    });
                  },
                  child: const Text('Resend Verification Email'),
                ),
                TextButton(
                  onPressed: () => Navigator.of(dialogContext).pop(),
                  child: const Text('Cancel'),
                ),
                FilledButton(
                  onPressed: () {
                    if (!formKey.currentState!.validate()) return;
                    Navigator.of(dialogContext).pop({
                      'email': emailController.text.trim(),
                      'password': passwordController.text,
                      'action': signup ? 'signup' : 'signin',
                    });
                  },
                  child: Text(signup ? 'Create Account' : 'Sign In'),
                ),
              ],
            );
          },
        );
      },
    );

    if (credentials == null || !mounted) return;

    String? firebaseEmailToken;

    try {
      if (credentials['action'] == 'reset') {
        await (widget.emailAuth ?? FirebaseAuth.instance)
            .sendPasswordResetEmail(email: credentials['email']!.trim());
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                'If this account can receive a reset email, instructions will be sent.',
              ),
            ),
          );
        }
        return;
      }
      await _sessionStore.clear();
      final loginRevision = AuthSessionStore.sessionRevision;
      final firebaseCredential = credentials['action'] == 'signup'
          ? await (widget.emailAuth ?? FirebaseAuth.instance)
                .createUserWithEmailAndPassword(
                  email: credentials['email']!.trim().toLowerCase(),
                  password: credentials['password']!,
                )
          : await (widget.emailAuth ?? FirebaseAuth.instance)
                .signInWithEmailAndPassword(
                  email: credentials['email']!.trim().toLowerCase(),
                  password: credentials['password']!,
                );

      final firebaseUser = firebaseCredential.user;

      if (firebaseUser != null &&
          (!firebaseUser.emailVerified || credentials['action'] == 'signup')) {
        try {
          await firebaseUser.sendEmailVerification();
        } finally {
          await (widget.emailAuth ?? FirebaseAuth.instance).signOut();
        }

        if (!mounted) return;

        ScaffoldMessenger.of(context)
          ..hideCurrentSnackBar()
          ..showSnackBar(
            const SnackBar(
              content: Text(
                'Verification email sent. Please verify your email, then sign in again.',
              ),
            ),
          );

        return;
      }

      if (firebaseUser == null) {
        throw const AuthApiException(
          'Firebase did not return an authenticated user.',
        );
      }

      final idToken = await firebaseUser.getIdToken(true);

      if (idToken == null || idToken.trim().isEmpty) {
        throw const AuthApiException('Firebase did not return an ID token.');
      }

      firebaseEmailToken = idToken.trim();

      var verifyResult = await _authApi.firebaseEmailLogin(
        idToken: firebaseEmailToken,
        portal: widget.portal,
      );

      if (!mounted) return;
      if (AuthSessionStore.sessionRevision != loginRevision ||
          (widget.emailAuth ?? FirebaseAuth.instance).currentUser?.uid !=
              firebaseUser.uid ||
          verifyResult.user['firebaseUid'] != firebaseUser.uid) {
        throw const AuthApiException(
          'The selected account changed. Please sign in again.',
        );
      }

      if (widget.portal == AuthPortal.customer &&
          (verifyResult.role != 'CUSTOMER' ||
              verifyResult.portal != 'customer')) {
        throw const AuthApiException(
          'This account is not authorized for customer login.',
        );
      }

      final hasGoogleProvider = firebaseUser.providerData.any(
        (provider) => provider.providerId == 'google.com',
      );
      final shouldLinkGoogle =
          hasGoogleProvider || widget.portal != AuthPortal.customer
          ? false
          : await _confirmEmailGoogleLink();

      if (shouldLinkGoogle && mounted) {
        try {
          final linkedGoogle = await GoogleAuthService.instance
              .linkGoogleToCurrentEmailAccount();
          verifyResult = await _authApi.confirmFirebaseEmailGoogleLink(
            idToken: linkedGoogle.firebaseIdToken,
            confirmAccountLink: true,
          );
        } on GoogleAuthCancelledException {
          // Keep the verified Email/Password session and continue sign-in.
        } on GoogleAuthException catch (error) {
          if (mounted) {
            ScaffoldMessenger.of(context)
              ..hideCurrentSnackBar()
              ..showSnackBar(
                SnackBar(
                  content: Text(error.message),
                  backgroundColor: Colors.red,
                ),
              );
          }
        } on AuthApiException catch (error) {
          if (mounted) {
            ScaffoldMessenger.of(context)
              ..hideCurrentSnackBar()
              ..showSnackBar(
                SnackBar(
                  content: Text(error.message),
                  backgroundColor: Colors.red,
                ),
              );
          }
        }
      }

      if (AuthSessionStore.sessionRevision != loginRevision ||
          (widget.emailAuth ?? FirebaseAuth.instance).currentUser?.uid !=
              firebaseUser.uid) {
        throw const AuthApiException(
          'The selected account changed. Please sign in again.',
        );
      }
      await _sessionStore.save(verifyResult);
      if (widget.portal != AuthPortal.customer) {
        final state = await _sessionStore.restore(portal: widget.portal.name);
        if (!mounted || state == null) return;
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute<void>(
            builder: (_) => state.nextStep == 'OPEN_ASTROLOGER_DASHBOARD'
                ? const AstrologerDashboardScreen()
                : AstrologerApplicationScreen(sessionStore: _sessionStore),
          ),
          (_) => false,
        );
        return;
      }

      if (!mounted) return;

      if (verifyResult.nextStep == 'OPEN_HOME' ||
          verifyResult.nextStep == 'COMPLETE_PROFILE') {
        await _openCustomerHomeWithFreeChat(verifyResult);
        return;
      }

      throw AuthApiException(
        'Unsupported customer login state: ${verifyResult.nextStep}',
      );
    } on AuthApiException catch (error) {
      if (!mounted) return;

      if (error.code == 'FIREBASE_EMAIL_LINK_REQUIRED' &&
          firebaseEmailToken != null) {
        try {
          await _linkFirebaseEmailWithVerifiedPhone(firebaseEmailToken);
        } on AuthApiException catch (linkError) {
          if (mounted) {
            ScaffoldMessenger.of(context)
              ..hideCurrentSnackBar()
              ..showSnackBar(
                SnackBar(
                  content: Text(linkError.message),
                  backgroundColor: Colors.red,
                ),
              );
          }
        } on FirebaseException catch (linkError) {
          if (mounted) {
            ScaffoldMessenger.of(context)
              ..hideCurrentSnackBar()
              ..showSnackBar(
                SnackBar(
                  content: Text(
                    linkError.code == 'too-many-requests'
                        ? 'Too many verification attempts. Wait before trying again.'
                        : 'Phone verification failed. Please try again.',
                  ),
                  backgroundColor: Colors.red,
                ),
              );
          }
        }
        return;
      }

      ScaffoldMessenger.of(context)
        ..hideCurrentSnackBar()
        ..showSnackBar(
          SnackBar(content: Text(error.message), backgroundColor: Colors.red),
        );
    } on FirebaseAuthException catch (error) {
      if (!mounted) return;
      final message = switch (error.code) {
        'invalid-email' => 'Enter a valid email address.',
        'weak-password' => 'Choose a stronger password.',
        'email-already-in-use' =>
          'An account already uses this email. Sign in or reset your password.',
        'invalid-credential' ||
        'wrong-password' ||
        'user-not-found' => 'Email or password is incorrect.',
        'too-many-requests' =>
          'Firebase has limited attempts. Please wait before trying again.',
        'network-request-failed' => 'Check your connection and try again.',
        'user-disabled' => 'This account is unavailable.',
        _ => 'Unable to complete email authentication. Please retry.',
      };
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(message)));
    } catch (_) {
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Email login failed. Please try again.')),
      );
    }
  }

  Future<bool> _confirmEmailGoogleLink() async {
    return await showDialog<bool>(
          context: context,
          builder: (dialogContext) => AlertDialog(
            backgroundColor: AppColors.surface,
            title: const Text('Link Google sign-in?'),
            content: const Text(
              'Google will be added to this verified email account. Both methods will continue to use the same Astro Soul Path account and its data.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext, false),
                child: const Text('Not now'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(dialogContext, true),
                child: const Text('Link Google'),
              ),
            ],
          ),
        ) ??
        false;
  }

  Future<String?> _verifyPhoneForGoogleLink({
    String linkedProvider = 'Google',
    bool useIsolatedFirebaseAuth = false,
  }) async {
    final consent = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: const Text('Link sign-in methods?'),
        content: const Text(
          'Verify the phone account you already use. Both sign-in methods will then open that same account. Wallet funds and customer data will not be moved.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Continue'),
          ),
        ],
      ),
    );

    if (consent != true || !mounted) {
      return null;
    }

    final phoneController = TextEditingController();
    final phone = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: AppColors.surface,
        title: const Text('Verify your phone account'),
        content: TextField(
          controller: phoneController,
          keyboardType: TextInputType.phone,
          decoration: const InputDecoration(
            labelText: 'Phone number with country code',
            hintText: '+919876543210',
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () {
              final value = phoneController.text.trim();
              if (!RegExp(r'^\+[1-9]\d{7,14}$').hasMatch(value)) {
                ScaffoldMessenger.of(dialogContext).showSnackBar(
                  const SnackBar(
                    content: Text('Enter a valid number with country code.'),
                  ),
                );
                return;
              }
              Navigator.pop(dialogContext, value);
            },
            child: const Text('Send code'),
          ),
        ],
      ),
    );
    phoneController.dispose();

    if (phone == null || !mounted) {
      return null;
    }

    final FirebasePhoneCode code;
    try {
      code = useIsolatedFirebaseAuth
          ? await FirebasePhoneAuthService.instance.sendProfileCode(
              phone: phone,
            )
          : await FirebasePhoneAuthService.instance.sendCode(phone: phone);
    } on FirebaseException catch (error) {
      final message = phoneOtpWaitMessage(
        error,
        'Unable to send a verification code. Please try again.',
      );
      throw AuthApiException(message, code: error.code);
    }

    if (!mounted) {
      return null;
    }

    final otpController = TextEditingController();
    final token = await showDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) {
        var verifying = false;
        String? errorMessage;

        return StatefulBuilder(
          builder: (context, setDialogState) => AlertDialog(
            backgroundColor: AppColors.surface,
            title: const Text('Enter verification code'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  '$linkedProvider will use this verified phone account. Code sent to ${phone.replaceAll(RegExp(r'(?<=.{4}).(?=.{2})'), '*')}',
                ),
                TextField(
                  controller: otpController,
                  keyboardType: TextInputType.number,
                  maxLength: 6,
                  decoration: InputDecoration(
                    labelText: 'SMS code',
                    errorText: errorMessage,
                  ),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: verifying
                    ? null
                    : () => Navigator.pop(dialogContext),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: verifying
                    ? null
                    : () async {
                        setDialogState(() {
                          verifying = true;
                          errorMessage = null;
                        });
                        try {
                          final verifiedToken = useIsolatedFirebaseAuth
                              ? await FirebasePhoneAuthService.instance
                                    .verifyProfilePhoneCode(
                                      verificationId: code.verificationId,
                                      smsCode: otpController.text.trim(),
                                    )
                              : await FirebasePhoneAuthService.instance
                                    .verifyCode(
                                      verificationId: code.verificationId,
                                      smsCode: otpController.text.trim(),
                                    );
                          if (dialogContext.mounted) {
                            Navigator.pop(dialogContext, verifiedToken);
                          }
                        } on FirebaseException catch (error) {
                          setDialogState(() {
                            verifying = false;
                            errorMessage = error.code == 'too-many-requests'
                                ? 'Too many attempts. Wait before trying again.'
                                : 'The code could not be verified. Check it and retry.';
                          });
                        }
                      },
                child: verifying
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Verify'),
              ),
            ],
          ),
        );
      },
    );
    otpController.dispose();
    return token;
  }

  Future<void> _linkGoogleWithVerifiedPhone(
    GoogleAuthResult googleResult,
  ) async {
    final firebaseIdToken = await _verifyPhoneForGoogleLink(
      linkedProvider: 'Google sign-in',
      useIsolatedFirebaseAuth: true,
    );

    if (firebaseIdToken == null || !mounted) {
      return;
    }

    await _authApi.linkFirebaseGoogleToPhone(
      firebaseGoogleIdToken: googleResult.firebaseIdToken,
      firebasePhoneIdToken: firebaseIdToken,
      confirmAccountLink: true,
    );

    final result = await _authApi.firebaseGoogleLogin(
      idToken: googleResult.firebaseIdToken,
      portal: AuthPortal.customer,
    );

    await _sessionStore.save(result);

    if (mounted) {
      await _openCustomerHomeWithFreeChat(result);
    }
  }

  Future<void> _linkFirebaseEmailWithVerifiedPhone(
    String firebaseEmailToken,
  ) async {
    final firebasePhoneToken = await _verifyPhoneForGoogleLink(
      linkedProvider: 'Email sign-in',
      useIsolatedFirebaseAuth: true,
    );

    if (firebasePhoneToken == null || !mounted) {
      return;
    }

    await _authApi.linkFirebaseEmailToVerifiedPhone(
      firebaseEmailToken: firebaseEmailToken,
      firebasePhoneToken: firebasePhoneToken,
      confirmAccountLink: true,
    );

    final result = await _authApi.firebaseEmailLogin(
      idToken: firebaseEmailToken,
    );

    await _sessionStore.save(result);

    if (mounted) {
      await _openCustomerHomeWithFreeChat(result);
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

    GoogleAuthResult? googleResult;

    try {
      // A user-initiated login fences old API clients before native selection.
      // Even a failed token acquisition must not retain a different app identity.
      await _sessionStore.clear();
      final loginRevision = AuthSessionStore.sessionRevision;
      googleResult =
          await (widget.googleSignIn ?? GoogleAuthService.instance.signIn)();
      if (AuthSessionStore.sessionRevision != loginRevision) {
        throw const AuthApiException(
          'The login session changed. Please choose your Google account again.',
        );
      }
      var verifyResult = await _authApi.firebaseGoogleLogin(
        idToken: googleResult.firebaseIdToken,
        portal: widget.portal,
      );

      if (!mounted) {
        return;
      }

      if (AuthSessionStore.sessionRevision != loginRevision ||
          (widget.firebaseUidReader != null
                  ? widget.firebaseUidReader!()
                  : FirebaseAuth.instance.currentUser?.uid) !=
              googleResult.user.uid) {
        throw const AuthApiException(
          'The selected account changed. Please choose your Google account again.',
        );
      }

      if (widget.portal == AuthPortal.customer &&
          (verifyResult.role != 'CUSTOMER' ||
              verifyResult.portal != 'customer' ||
              verifyResult.session['authProvider'] != 'asp-context' ||
              verifyResult.user['authContext'] != 'customer')) {
        throw const AuthApiException(
          'The selected Google account is not a customer account. Choose a different existing customer Google account. No permissions were changed.',
        );
      }

      if (widget.portal == AuthPortal.customer &&
          verifyResult.user['isNewUser'] == true) {
        final shouldLinkPhone = await showDialog<bool>(
          context: context,
          builder: (dialogContext) => AlertDialog(
            backgroundColor: AppColors.surface,
            title: const Text('Already have an account?'),
            content: const Text(
              'Verify the phone number on your existing account to use it with Google. You can also continue with a separate Google account.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(dialogContext, false),
                child: const Text('Continue with Google'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(dialogContext, true),
                child: const Text('Link phone account'),
              ),
            ],
          ),
        );

        if (shouldLinkPhone == true) {
          await _linkGoogleWithVerifiedPhone(googleResult);
          return;
        }
      }

      if (AuthSessionStore.sessionRevision != loginRevision ||
          (widget.firebaseUidReader != null
                  ? widget.firebaseUidReader!()
                  : FirebaseAuth.instance.currentUser?.uid) !=
              googleResult.user.uid) {
        throw const AuthApiException(
          'The selected account changed. Please sign in again.',
        );
      }
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
          Navigator.of(context).pushReplacement(
            MaterialPageRoute<void>(
              builder: (_) => const AstrologerApplicationScreen(),
            ),
          );
          return;
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
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(
          const SnackBar(
            content: Text('Unable to complete secure sign-in. Please retry.'),
            backgroundColor: Colors.red,
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
  Widget build(BuildContext context) => CelestialLoginLayout(
    portal: widget.portal,
    busy: _isSendingOtp,
    onGoogle: _continueWithGoogle,
    onEmail: _continueWithEmailPassword,
    onBack: Navigator.of(context).pop,
  );
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
          width: 50,
          height: 50,
          child: Center(
            child: Icon(Icons.apple, color: AppColors.background, size: 25),
          ),
        ),
      ),
    );
  }
}
