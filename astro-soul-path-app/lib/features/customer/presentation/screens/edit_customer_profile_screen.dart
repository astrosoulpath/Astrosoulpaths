import 'dart:async';

import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../profile/data/customer_profile.dart';
import '../../../profile/data/geo_api.dart';
import '../../../auth/data/firebase_phone_auth_service.dart';
import '../../../auth/data/phone_otp_send_cooldown.dart';
import '../../../profile/data/profile_api.dart';
import '../../../auth/data/auth_session_store.dart';
import '../widgets/customer_email_address.dart';

class EditCustomerProfileScreen extends StatefulWidget {
  const EditCustomerProfileScreen({
    required this.profile,
    super.key,
    this.profileApi,
    this.sendPhoneCode,
    this.verifyPhoneCode,
    this.now,
    this.sessionStore,
    this.showPhoneVerificationForTesting = false,
  });
  final ProfileApi? profileApi;
  final AuthSessionStore? sessionStore;
  // Retained only for regression testing the hidden legacy OTP controls.
  @visibleForTesting
  final bool showPhoneVerificationForTesting;
  final DateTime Function()? now;
  final Future<FirebasePhoneCode> Function(String phone, int? resendToken)?
  sendPhoneCode;
  final Future<String> Function(String verificationId, String smsCode)?
  verifyPhoneCode;

  final CustomerProfile? profile;

  @override
  State<EditCustomerProfileScreen> createState() =>
      _EditCustomerProfileScreenState();
}

class _EditCustomerProfileScreenState extends State<EditCustomerProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  StoredAuthSession? _emailSession;

  Future<void> _loadCanonicalEmail() async {
    try {
      final session = await (widget.sessionStore ?? AuthSessionStore()).restore(
        portal: 'customer',
      );
      if (mounted) setState(() => _emailSession = session);
    } catch (_) {
      // Never fall back to a profile/contact email on authentication failure.
      if (mounted) setState(() => _emailSession = null);
    }
  }

  late final ProfileApi _profileApi = widget.profileApi ?? ProfileApi();
  final GeoApi _geoApi = GeoApi();

  late final TextEditingController _fullNameController;
  late final TextEditingController _dobController;
  late final TextEditingController _tobController;
  late final TextEditingController _cityController;
  late final TextEditingController _stateController;
  late final TextEditingController _countryController;
  late final TextEditingController _occupationController;
  late final TextEditingController _phoneController;

  bool _isPhoneVerified = false;
  bool _isSendingPhoneOtp = false;
  DateTime? _phoneOtpCooldownUntil;
  Timer? _phoneOtpCooldownTimer;
  int get _phoneOtpSeconds => widget.sendPhoneCode == null
      ? PhoneOtpSendCooldown.shared.remainingSeconds
      : _phoneOtpCooldownUntil == null
      ? 0
      : ((_phoneOtpCooldownUntil!
                        .difference((widget.now ?? DateTime.now)())
                        .inMilliseconds /
                    1000)
                .ceil())
            .clamp(0, 60);

  Future<void> _restoreSharedPhoneCooldown() async {
    try {
      await PhoneOtpSendCooldown.shared.load();
      if (mounted) {
        _startPhoneOtpCooldown();
        setState(() {});
      }
    } catch (_) {
      // The send guard fails closed if secure storage is unavailable.
    }
  }

  void _startPhoneOtpCooldown() {
    _phoneOtpCooldownUntil = (widget.now ?? DateTime.now)().add(
      const Duration(seconds: 60),
    );
    _phoneOtpCooldownTimer?.cancel();
    _phoneOtpCooldownTimer = Timer.periodic(const Duration(seconds: 1), (
      timer,
    ) {
      if (!mounted || _phoneOtpSeconds == 0) timer.cancel();
      if (mounted) setState(() {});
    });
  }

  Future<FirebasePhoneCode> _sendPhoneCode(String phone, int? resendToken) =>
      widget.sendPhoneCode != null
      ? widget.sendPhoneCode!(phone, resendToken)
      : FirebasePhoneAuthService.instance.sendProfileCode(
          phone: phone,
          forceResendingToken: resendToken,
        );

  String _firebasePhoneError(FirebaseException error) => phoneOtpWaitMessage(
    error,
    'Phone verification failed. Please check the code or retry later.',
  );

  Timer? _cityDebounce;

  List<GeoSuggestion> _geoSuggestions = [];

  bool _isSaving = false;
  bool _isSearchingCity = false;
  bool _birthTimeKnown = true;

  String _countryCode = '';
  double _latitude = 0;
  double _longitude = 0;
  double _timezone = 0;
  String _timezoneName = '';

  @override
  void initState() {
    super.initState();
    _loadCanonicalEmail();
    if (widget.sendPhoneCode == null) _restoreSharedPhoneCooldown();

    final profile = widget.profile;
    _birthTimeKnown = profile?.birthTimeKnown ?? true;

    _fullNameController = TextEditingController(
      text: profile?.fullName ?? profile?.name ?? '',
    );

    _dobController = TextEditingController(
      text: profile == null ? '' : _formatDate(profile.birthDate),
    );

    _tobController = TextEditingController(
      text: _birthTimeKnown ? (profile?.birthTime ?? '') : '',
    );

    _cityController = TextEditingController(text: profile?.city ?? '');

    _stateController = TextEditingController(text: profile?.state ?? '');

    _countryController = TextEditingController(text: profile?.country ?? '');

    _occupationController = TextEditingController(
      text: profile?.occupation ?? '',
    );
    final existingPhone = profile?.phoneNumber?.trim() ?? '';

    _phoneController = TextEditingController(text: existingPhone);
    _isPhoneVerified = profile?.isPhoneVerified == true;

    _countryCode = profile?.countryCode ?? '';
    _latitude = profile?.latitude ?? 0;
    _longitude = profile?.longitude ?? 0;
    _timezone = profile?.timezone ?? 0;
    _timezoneName = profile?.timezoneName ?? '';
  }

  @override
  void dispose() {
    _cityDebounce?.cancel();
    _phoneOtpCooldownTimer?.cancel();

    _profileApi.close();
    _geoApi.close();

    _fullNameController.dispose();
    _dobController.dispose();
    _tobController.dispose();
    _cityController.dispose();
    _stateController.dispose();
    _countryController.dispose();
    _occupationController.dispose();
    _phoneController.dispose();

    super.dispose();
  }

  String _formatDate(DateTime value) {
    final year = value.year.toString().padLeft(4, '0');
    final month = value.month.toString().padLeft(2, '0');
    final day = value.day.toString().padLeft(2, '0');

    return '$year-$month-$day';
  }

  Future<void> _pickDate() async {
    final current =
        DateTime.tryParse(_dobController.text) ??
        widget.profile?.birthDate ??
        DateTime(2000, 1, 1);

    final selected = await showDatePicker(
      context: context,
      initialDate: current,
      firstDate: DateTime(1900),
      lastDate: (widget.now ?? DateTime.now)(),
    );

    if (selected == null) {
      return;
    }

    _dobController.text = _formatDate(selected);
  }

  Future<void> _pickTime() async {
    final parts = _tobController.text.split(':');

    final initialTime = TimeOfDay(
      hour: int.tryParse(parts.isNotEmpty ? parts[0] : '') ?? 12,
      minute: int.tryParse(parts.length > 1 ? parts[1] : '') ?? 0,
    );

    final selected = await showTimePicker(
      context: context,
      initialTime: initialTime,
    );

    if (selected == null) {
      return;
    }

    final hour = selected.hour.toString().padLeft(2, '0');
    final minute = selected.minute.toString().padLeft(2, '0');

    _tobController.text = '$hour:$minute';
  }

  void _onCityChanged(String value) {
    _cityDebounce?.cancel();

    final query = value.trim();

    if (query.length < 2) {
      setState(() {
        _geoSuggestions = [];
        _isSearchingCity = false;
      });
      return;
    }

    _cityDebounce = Timer(
      const Duration(milliseconds: 450),
      () => _searchCity(query),
    );
  }

  Future<void> _searchCity(String query) async {
    if (!mounted) {
      return;
    }

    setState(() {
      _isSearchingCity = true;
    });

    try {
      final suggestions = await _geoApi.searchCity(query);

      if (!mounted) {
        return;
      }

      if (_cityController.text.trim() != query) {
        return;
      }

      setState(() {
        _geoSuggestions = suggestions;
      });
    } on GeoApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _geoSuggestions = [];
      });

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) {
        setState(() {
          _isSearchingCity = false;
        });
      }
    }
  }

  void _selectGeoSuggestion(GeoSuggestion suggestion) {
    _cityDebounce?.cancel();

    setState(() {
      _cityController.text = suggestion.city;
      _stateController.text = suggestion.state;
      _countryController.text = suggestion.country;

      _countryCode = suggestion.countryCode;
      _latitude = suggestion.latitude;
      _longitude = suggestion.longitude;
      _timezone = suggestion.timezone;
      _timezoneName = suggestion.timezoneName;

      _geoSuggestions = [];
      _isSearchingCity = false;
    });

    FocusScope.of(context).unfocus();
  }

  String? _phoneForVerification() {
    final phone = _phoneController.text.trim().replaceAll(
      RegExp(r'[\s\-\(\)]'),
      '',
    );

    if (!RegExp(r'^\+[1-9]\d{7,14}$').hasMatch(phone)) {
      return null;
    }

    return phone;
  }

  Future<void> _sendPhoneVerificationOtp() async {
    if (_isSendingPhoneOtp || _phoneOtpSeconds > 0) {
      return;
    }

    final phone = _phoneForVerification();

    if (phone == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a valid mobile number.')),
      );
      return;
    }

    setState(() {
      _isSendingPhoneOtp = true;
    });

    try {
      _startPhoneOtpCooldown();
      final firebaseCode = await _sendPhoneCode(phone, null);

      if (!mounted) {
        return;
      }

      await _showPhoneOtpDialog(phone, firebaseCode);
    } on FirebaseException catch (error) {
      if (!mounted) return;
      if (error.code == 'too-many-requests') _startPhoneOtpCooldown();
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(_firebasePhoneError(error))));
    } on ProfileApiException catch (error) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    } catch (error) {
      if (!mounted) {
        return;
      }

      final details = error.toString();
      debugPrint('PROFILE_PHONE_OTP_ERROR: $details');

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Unable to send phone OTP. Please retry later.'),
          duration: const Duration(seconds: 12),
        ),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isSendingPhoneOtp = false;
        });
      }
    }
  }

  Future<void> _showPhoneOtpDialog(String phone, FirebasePhoneCode code) async {
    final otpController = TextEditingController();

    var verifying = false;
    var resending = false;
    var currentVerificationId = code.verificationId;
    var currentResendToken = code.resendToken;
    StateSetter? refreshDialog;
    var dialogOpen = true;
    final cooldownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted && dialogOpen) refreshDialog?.call(() {});
    });

    final otpRoute = DialogRoute<void>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) {
        return StatefulBuilder(
          builder: (dialogContext, setDialogState) {
            refreshDialog = (callback) {
              if (dialogContext.mounted) setDialogState(callback);
            };
            Future<void> verify() async {
              if (verifying || resending) return;
              final otp = otpController.text.trim();

              if (otp.length < 4) {
                ScaffoldMessenger.of(dialogContext).showSnackBar(
                  const SnackBar(content: Text('Enter the OTP code.')),
                );
                return;
              }

              setDialogState(() {
                verifying = true;
              });

              String? verifiedFirebaseToken;

              try {
                final firebaseIdToken = widget.verifyPhoneCode != null
                    ? await widget.verifyPhoneCode!(currentVerificationId, otp)
                    : await FirebasePhoneAuthService.instance
                          .verifyProfilePhoneCode(
                            verificationId: currentVerificationId,
                            smsCode: otp,
                          );

                verifiedFirebaseToken = firebaseIdToken;
                await _profileApi.verifyFirebaseProfilePhone(
                  firebaseIdToken: firebaseIdToken,
                );

                if (!mounted) {
                  return;
                }

                final confirmedPhone = await _profileApi.refreshVerifiedPhone();
                if (!mounted) return;
                final verifiedPhone = confirmedPhone['phone'] as String;

                setState(() {
                  _isPhoneVerified = true;
                  _phoneController.text = verifiedPhone;
                });

                if (dialogContext.mounted) {
                  Navigator.of(dialogContext).pop();
                }

                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Mobile number verified successfully'),
                    ),
                  );
                }
              } on FirebaseException catch (error) {
                if (error.code == 'too-many-requests') _startPhoneOtpCooldown();
                if (dialogContext.mounted) {
                  ScaffoldMessenger.of(dialogContext).showSnackBar(
                    SnackBar(content: Text(_firebasePhoneError(error))),
                  );
                }
              } on ProfileApiException catch (error) {
                if (dialogContext.mounted) {
                  if (error.code == 'PHONE_ACCOUNT_LINK_REQUIRED') {
                    await showDialog<void>(
                      context: dialogContext,
                      builder: (context) => AlertDialog(
                        title: const Text('Existing Account Found'),
                        content: const Text(
                          'This mobile number belongs to an existing account. '
                          'Secure linking is required before both login methods '
                          'can access the same account. Wallet balance and '
                          'subscriptions will not transfer automatically.',
                        ),
                        actions: [
                          TextButton(
                            onPressed: () => Navigator.pop(context),
                            child: const Text('Cancel'),
                          ),
                          TextButton(
                            onPressed: () async {
                              final token = verifiedFirebaseToken;

                              if (token == null || token.isEmpty) {
                                Navigator.pop(context);
                                return;
                              }

                              Navigator.pop(context);

                              try {
                                final linkResult = await _profileApi
                                    .verifyFirebaseProfilePhone(
                                      firebaseIdToken: token,
                                      confirmAccountLink: true,
                                    );

                                final data = linkResult['data'];
                                final linkData = data is Map
                                    ? data
                                    : <String, dynamic>{};

                                final accountLinked =
                                    linkData['accountLinked'] == true;
                                final canonicalUserId =
                                    linkData['canonicalUserId']
                                        ?.toString()
                                        .trim() ??
                                    '';

                                if (!accountLinked || canonicalUserId.isEmpty) {
                                  throw const ProfileApiException(
                                    'Account linking was not confirmed by the server.',
                                  );
                                }
                                if (!mounted) return;

                                setState(() {
                                  _isPhoneVerified = true;
                                  _phoneController.text = phone;
                                });

                                if (dialogContext.mounted) {
                                  Navigator.of(dialogContext).pop();
                                }

                                if (mounted) {
                                  ScaffoldMessenger.of(
                                    this.context,
                                  ).showSnackBar(
                                    const SnackBar(
                                      content: Text(
                                        'Accounts linked successfully. Please sign out and sign in again to refresh your account.',
                                      ),
                                    ),
                                  );
                                }
                              } on ProfileApiException catch (linkError) {
                                if (!mounted) return;

                                ScaffoldMessenger.of(this.context).showSnackBar(
                                  SnackBar(content: Text(linkError.message)),
                                );
                              }
                            },
                            child: const Text('Link Accounts'),
                          ),
                        ],
                      ),
                    );
                  } else {
                    ScaffoldMessenger.of(
                      dialogContext,
                    ).showSnackBar(SnackBar(content: Text(error.message)));
                  }
                }
              } catch (_) {
                if (dialogContext.mounted) {
                  ScaffoldMessenger.of(dialogContext).showSnackBar(
                    const SnackBar(
                      content: Text(
                        'Verification failed. Please check the OTP.',
                      ),
                    ),
                  );
                }
              } finally {
                if (dialogContext.mounted) {
                  setDialogState(() {
                    verifying = false;
                  });
                }
              }
            }

            Future<void> resend() async {
              if (resending || verifying || _phoneOtpSeconds > 0) {
                return;
              }

              setDialogState(() {
                resending = true;
              });

              try {
                _startPhoneOtpCooldown();
                final newCode = await _sendPhoneCode(phone, currentResendToken);

                currentVerificationId = newCode.verificationId;
                currentResendToken = newCode.resendToken;

                if (dialogContext.mounted) {
                  ScaffoldMessenger.of(dialogContext).showSnackBar(
                    const SnackBar(content: Text('OTP sent again')),
                  );
                }
              } on FirebaseException catch (error) {
                if (error.code == 'too-many-requests') _startPhoneOtpCooldown();
                if (dialogContext.mounted) {
                  ScaffoldMessenger.of(dialogContext).showSnackBar(
                    SnackBar(content: Text(_firebasePhoneError(error))),
                  );
                }
              } catch (_) {
                if (dialogContext.mounted) {
                  ScaffoldMessenger.of(dialogContext).showSnackBar(
                    const SnackBar(
                      content: Text(
                        'Unable to resend OTP. Please retry later.',
                      ),
                    ),
                  );
                }
              } finally {
                if (dialogContext.mounted) {
                  setDialogState(() {
                    resending = false;
                  });
                }
              }
            }

            return AlertDialog(
              title: const Text('Verify Mobile Number'),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('OTP sent to $phone'),
                  const SizedBox(height: 16),
                  TextField(
                    controller: otpController,
                    autofocus: true,
                    keyboardType: TextInputType.number,
                    textInputAction: TextInputAction.done,
                    onSubmitted: verifying || resending
                        ? null
                        : (_) => verify(),
                    decoration: const InputDecoration(
                      labelText: 'OTP',
                      hintText: 'Enter verification code',
                      prefixIcon: Icon(Icons.lock_outline_rounded),
                    ),
                  ),
                  const SizedBox(height: 4),
                  TextButton(
                    onPressed: verifying || resending || _phoneOtpSeconds > 0
                        ? null
                        : resend,
                    child: Text(
                      resending
                          ? 'Sending...'
                          : _phoneOtpSeconds > 0
                          ? 'Resend OTP in ${_phoneOtpSeconds}s'
                          : 'Resend OTP',
                    ),
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: verifying || resending
                      ? null
                      : () => Navigator.of(dialogContext).pop(),
                  child: const Text('Cancel'),
                ),
                FilledButton(
                  onPressed: verifying || resending ? null : verify,
                  child: verifying
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text('Verify'),
                ),
              ],
            );
          },
        );
      },
    );

    await Navigator.of(context).push(otpRoute);
    dialogOpen = false;
    cooldownTimer.cancel();
    await otpRoute.completed;
    otpController.dispose();
  }

  Future<void> _saveProfile() async {
    if (_isSaving) {
      return;
    }

    if (!_formKey.currentState!.validate()) {
      return;
    }

    if (_countryCode.trim().isEmpty ||
        _timezoneName.trim().isEmpty ||
        _latitude < -90 ||
        _latitude > 90 ||
        _longitude < -180 ||
        _longitude > 180) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Please select a valid birth place from the suggestions.',
          ),
        ),
      );
      return;
    }

    setState(() {
      _isSaving = true;
    });

    try {
      final fullName = _fullNameController.text.trim();

      final existingProfile = widget.profile;

      if (existingProfile == null) {
        await _profileApi.createProfile(
          name: fullName,
          fullName: fullName,
          dob: _dobController.text.trim(),
          tob: _birthTimeKnown ? _tobController.text.trim() : null,
          birthTimeKnown: _birthTimeKnown,
          city: _cityController.text.trim(),
          state: _stateController.text.trim(),
          country: _countryController.text.trim(),
          countryCode: _countryCode,
          occupation: _occupationController.text.trim(),
          lat: _latitude,
          lon: _longitude,
          timezone: _timezone,
          timezoneName: _timezoneName,
        );
      } else {
        await _profileApi.updateProfile(
          profileId: existingProfile.id,
          name: fullName,
          fullName: fullName,
          dob: _dobController.text.trim(),
          tob: _birthTimeKnown ? _tobController.text.trim() : null,
          birthTimeKnown: _birthTimeKnown,
          city: _cityController.text.trim(),
          state: _stateController.text.trim(),
          country: _countryController.text.trim(),
          countryCode: _countryCode,
          occupation: _occupationController.text.trim(),
          lat: _latitude,
          lon: _longitude,
          timezone: _timezone,
          timezoneName: _timezoneName,
        );
      }

      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Profile updated successfully')),
      );

      Navigator.of(context).pop(true);
    } on ProfileApiException catch (error) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) {
        setState(() {
          _isSaving = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    InputDecoration fieldDecoration({
      required String label,
      required IconData icon,
      String? hint,
      Widget? suffixIcon,
    }) {
      return InputDecoration(
        labelText: label,
        hintText: hint,
        prefixIcon: Icon(icon, color: AppColors.gold),
        suffixIcon: suffixIcon,
        filled: true,
        fillColor: AppColors.surface,
        labelStyle: const TextStyle(
          color: AppColors.muted,
          fontWeight: FontWeight.w600,
        ),
        hintStyle: const TextStyle(color: AppColors.muted),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(
            color: AppColors.muted.withValues(alpha: 0.14),
          ),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(
            color: AppColors.muted.withValues(alpha: 0.14),
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: AppColors.gold, width: 1.4),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: Colors.redAccent),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: const BorderSide(color: Colors.redAccent, width: 1.2),
        ),
        contentPadding: const EdgeInsets.symmetric(
          horizontal: 16,
          vertical: 16,
        ),
      );
    }

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        foregroundColor: AppColors.white,
        elevation: 0,
        titleSpacing: 0,
        title: const Text(
          'Edit Profile',
          style: TextStyle(fontWeight: FontWeight.w900, fontSize: 20),
        ),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 32),
          children: [
            Container(
              padding: const EdgeInsets.fromLTRB(18, 20, 18, 20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [AppColors.surfaceLight, AppColors.surface],
                ),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(
                  color: AppColors.gold.withValues(alpha: 0.20),
                ),
              ),
              child: Row(
                children: [
                  Container(
                    width: 52,
                    height: 52,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.gold.withValues(alpha: 0.12),
                      border: Border.all(
                        color: AppColors.gold.withValues(alpha: 0.35),
                      ),
                    ),
                    child: const Icon(
                      Icons.auto_awesome_rounded,
                      color: AppColors.gold,
                      size: 26,
                    ),
                  ),
                  const SizedBox(width: 14),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Personalize your profile',
                          style: TextStyle(
                            color: AppColors.white,
                            fontSize: 17,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        SizedBox(height: 5),
                        Text(
                          'Keep your birth details accurate for a better astrology experience.',
                          style: TextStyle(
                            color: AppColors.muted,
                            fontSize: 12,
                            height: 1.4,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 26),

            const _EditSectionHeader(
              icon: Icons.person_outline_rounded,
              title: 'Personal Details',
            ),

            const SizedBox(height: 12),

            TextFormField(
              controller: _fullNameController,
              decoration: fieldDecoration(
                label: 'Full Name',
                icon: Icons.person_outline_rounded,
              ),
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return 'Full name is required';
                }
                return null;
              },
            ),

            const SizedBox(height: 18),

            CustomerEmailAddress(
              session: _emailSession,
              asField: true,
              decoration: fieldDecoration(
                label: 'Email Address',
                icon: Icons.email_outlined,
              ),
            ),
            if (widget.showPhoneVerificationForTesting) ...[
              TextFormField(
                controller: _phoneController,
                keyboardType: TextInputType.phone,
                readOnly: _isPhoneVerified,
                decoration: fieldDecoration(
                  label: 'Mobile Number',
                  hint: '+91 9876543210',
                  icon: Icons.phone_android_rounded,
                  suffixIcon: _isPhoneVerified
                      ? const Icon(Icons.verified_rounded, color: Colors.green)
                      : TextButton(
                          onPressed: _isSendingPhoneOtp || _phoneOtpSeconds > 0
                              ? null
                              : _sendPhoneVerificationOtp,
                          child: _isSendingPhoneOtp
                              ? const SizedBox(
                                  width: 18,
                                  height: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Text('Verify'),
                        ),
                ),
              ),

              const SizedBox(height: 8),

              if (_isPhoneVerified)
                const Row(
                  children: [
                    Icon(
                      Icons.check_circle_rounded,
                      size: 16,
                      color: Colors.green,
                    ),
                    SizedBox(width: 6),
                    Text(
                      'Verified mobile number',
                      style: TextStyle(
                        color: Colors.green,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                )
              else
                const Text(
                  'Enter full mobile number with country code, for example +91 9876543210.',
                  style: TextStyle(fontSize: 12, color: Colors.grey),
                ),
            ],

            const _EditSectionHeader(
              icon: Icons.auto_awesome_rounded,
              title: 'Birth Details',
            ),

            const SizedBox(height: 12),

            TextFormField(
              controller: _dobController,
              readOnly: true,
              onTap: _isSaving ? null : _pickDate,
              decoration: fieldDecoration(
                label: 'Date of Birth',
                icon: Icons.calendar_today_outlined,
              ),
            ),

            const SizedBox(height: 12),

            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                border: Border.all(color: Theme.of(context).dividerColor),
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Do you know your exact birth time?',
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: ChoiceChip(
                          label: const Text('Yes'),
                          selected: _birthTimeKnown,
                          onSelected: _isSaving
                              ? null
                              : (_) {
                                  setState(() {
                                    _birthTimeKnown = true;
                                  });
                                },
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ChoiceChip(
                          label: const Text('No'),
                          selected: !_birthTimeKnown,
                          onSelected: _isSaving
                              ? null
                              : (_) {
                                  setState(() {
                                    _birthTimeKnown = false;
                                    _tobController.clear();
                                  });
                                },
                        ),
                      ),
                    ],
                  ),
                  if (!_birthTimeKnown) ...[
                    const SizedBox(height: 10),
                    Text(
                      'Birth time will be saved as unknown. No estimated time will be used.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                ],
              ),
            ),

            if (_birthTimeKnown) ...[
              const SizedBox(height: 12),
              TextFormField(
                controller: _tobController,
                readOnly: true,
                onTap: _isSaving ? null : _pickTime,
                decoration: fieldDecoration(
                  label: 'Time of Birth',
                  icon: Icons.schedule_outlined,
                ),
              ),
            ],

            const SizedBox(height: 24),

            const _EditSectionHeader(
              icon: Icons.location_on_outlined,
              title: 'Birth Location',
            ),

            const SizedBox(height: 12),

            TextFormField(
              controller: _cityController,
              enabled: !_isSaving,
              onChanged: _onCityChanged,
              decoration: fieldDecoration(
                label: 'Birth Place / City',
                icon: Icons.location_on_outlined,
                hint: 'Search your birth city',
                suffixIcon: _isSearchingCity
                    ? const Padding(
                        padding: EdgeInsets.all(14),
                        child: SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: AppColors.gold,
                          ),
                        ),
                      )
                    : const Icon(Icons.search_rounded, color: AppColors.muted),
              ),
              validator: (value) {
                if (value == null || value.trim().isEmpty) {
                  return 'Birth place is required';
                }
                return null;
              },
            ),

            if (_geoSuggestions.isNotEmpty) ...[
              const SizedBox(height: 10),
              Container(
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(
                    color: AppColors.gold.withValues(alpha: 0.18),
                  ),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(18),
                  child: Column(
                    children: _geoSuggestions.map((suggestion) {
                      return InkWell(
                        onTap: () => _selectGeoSuggestion(suggestion),
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                width: 38,
                                height: 38,
                                decoration: BoxDecoration(
                                  color: AppColors.gold.withValues(alpha: 0.10),
                                  borderRadius: BorderRadius.circular(11),
                                ),
                                child: const Icon(
                                  Icons.location_on_rounded,
                                  color: AppColors.gold,
                                  size: 20,
                                ),
                              ),
                              const SizedBox(width: 11),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      suggestion.fullName,
                                      style: const TextStyle(
                                        color: AppColors.white,
                                        fontWeight: FontWeight.w800,
                                        fontSize: 13,
                                      ),
                                    ),
                                    const SizedBox(height: 5),
                                    Text(
                                      '${suggestion.countryCode} \u2022 '
                                      '${suggestion.latitude}, '
                                      '${suggestion.longitude}',
                                      style: const TextStyle(
                                        color: AppColors.muted,
                                        fontSize: 11,
                                        height: 1.35,
                                      ),
                                    ),
                                    const SizedBox(height: 3),
                                    Text(
                                      suggestion.timezoneName,
                                      style: const TextStyle(
                                        color: AppColors.gold,
                                        fontSize: 11,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const Icon(
                                Icons.chevron_right_rounded,
                                color: AppColors.muted,
                              ),
                            ],
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ),
            ],

            const SizedBox(height: 12),

            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _stateController,
                    readOnly: true,
                    decoration: fieldDecoration(
                      label: 'State',
                      icon: Icons.map_outlined,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: _countryController,
                    readOnly: true,
                    decoration: fieldDecoration(
                      label: 'Country',
                      icon: Icons.public_outlined,
                    ),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 24),

            const _EditSectionHeader(
              icon: Icons.public_rounded,
              title: 'Astrology Location Data',
            ),

            const SizedBox(height: 12),

            Container(
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: AppColors.gold.withValues(alpha: 0.14),
                ),
              ),
              child: Column(
                children: [
                  _EditInfoRow(
                    icon: Icons.my_location_rounded,
                    title: 'Coordinates',
                    value: '$_latitude, $_longitude',
                  ),
                  _EditInfoRow(
                    icon: Icons.flag_outlined,
                    title: 'Country Code',
                    value: _countryCode.isEmpty ? 'Not selected' : _countryCode,
                    showDivider: true,
                  ),
                  _EditInfoRow(
                    icon: Icons.access_time_rounded,
                    title: 'Timezone',
                    value: _timezoneName.isEmpty
                        ? 'Not selected'
                        : '$_timezoneName (UTC ${_timezone >= 0 ? '+' : ''}$_timezone)',
                    showDivider: true,
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            const _EditSectionHeader(
              icon: Icons.work_outline_rounded,
              title: 'Professional Details',
            ),

            const SizedBox(height: 12),

            TextFormField(
              controller: _occupationController,
              decoration: fieldDecoration(
                label: 'Occupation',
                icon: Icons.work_outline_rounded,
                hint: 'e.g. Software Engineer',
              ),
            ),

            const SizedBox(height: 30),

            Container(
              padding: const EdgeInsets.all(5),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(18),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.gold.withValues(alpha: 0.14),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: FilledButton.icon(
                onPressed: _isSaving ? null : _saveProfile,
                icon: _isSaving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: AppColors.background,
                        ),
                      )
                    : const Icon(Icons.save_rounded),
                label: Text(
                  _isSaving ? 'Saving...' : 'Save Changes',
                  style: const TextStyle(fontWeight: FontWeight.w800),
                ),
                style: FilledButton.styleFrom(
                  minimumSize: const Size.fromHeight(56),
                  backgroundColor: AppColors.gold,
                  foregroundColor: AppColors.background,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(15),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _EditSectionHeader extends StatelessWidget {
  const _EditSectionHeader({required this.icon, required this.title});

  final IconData icon;
  final String title;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 34,
          height: 34,
          decoration: BoxDecoration(
            color: AppColors.gold.withValues(alpha: 0.10),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, size: 18, color: AppColors.gold),
        ),
        const SizedBox(width: 10),
        Text(
          title,
          style: const TextStyle(
            color: AppColors.white,
            fontSize: 16,
            fontWeight: FontWeight.w900,
          ),
        ),
      ],
    );
  }
}

class _EditInfoRow extends StatelessWidget {
  const _EditInfoRow({
    required this.icon,
    required this.title,
    required this.value,
    this.showDivider = false,
  });

  final IconData icon;
  final String title;
  final String value;
  final bool showDivider;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 15),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: AppColors.gold.withValues(alpha: 0.08),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Icon(icon, size: 20, color: AppColors.gold),
              ),
              const SizedBox(width: 13),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      value,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        if (showDivider)
          Padding(
            padding: const EdgeInsets.only(left: 69),
            child: Divider(
              height: 1,
              color: AppColors.muted.withValues(alpha: 0.12),
            ),
          ),
      ],
    );
  }
}
