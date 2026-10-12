import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import '../../../auth/data/auth_session_store.dart';
import '../../../auth/data/firebase_phone_auth_service.dart';
import '../../../profile/data/profile_api.dart';
import '../../../customer/presentation/screens/customer_shell_screen.dart';
import 'astrologer_dashboard_screen.dart';
import 'astrologer_qualification_screen.dart';
import 'astrologer_registration_screen.dart';

class AstrologerApplicationScreen extends StatefulWidget {
  const AstrologerApplicationScreen({
    super.key,
    this.sessionStore,
    this.profileApi,
    this.sendPhoneCode,
    this.verifyPhoneCode,
  });
  final AuthSessionStore? sessionStore;
  final ProfileApi? profileApi;
  final Future<FirebasePhoneCode> Function(String phone)? sendPhoneCode;
  final Future<String> Function(String verificationId, String smsCode)?
  verifyPhoneCode;
  @override
  State<AstrologerApplicationScreen> createState() =>
      _AstrologerApplicationScreenState();
}

class _AstrologerApplicationScreenState
    extends State<AstrologerApplicationScreen> {
  late final _sessions = widget.sessionStore ?? AuthSessionStore();
  late final _profile = widget.profileApi ?? ProfileApi();
  final _phone = TextEditingController();
  final _otp = TextEditingController();
  StoredAuthSession? _state;
  String? _verificationId;
  String? _error;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _phone.dispose();
    _otp.dispose();
    _profile.close();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final session = await _sessions.restore(
        portal: 'joinAstrologer',
        persist: false,
      );
      if (session == null) throw StateError('Please sign in to continue.');
      if (!mounted) return;
      setState(() {
        _state = session;
        _phone.text = session.user['phone']?.toString() ?? '';
      });
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = 'Unable to verify your application status. Please retry.';
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
        });
      }
    }
  }

  Future<void> _sendOtp() async {
    if (!RegExp(r'^\+[1-9]\d{7,14}$').hasMatch(_phone.text.trim())) {
      setState(() {
        _error =
            'Enter a phone number with country code, such as +919876543210.';
      });
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final code = widget.sendPhoneCode != null
          ? await widget.sendPhoneCode!(_phone.text.trim())
          : await FirebasePhoneAuthService.instance.sendProfileCode(
              phone: _phone.text.trim(),
            );
      if (mounted) {
        setState(() {
          _verificationId = code.verificationId;
        });
      }
    } on FirebaseException {
      if (mounted) {
        setState(() {
          _error = 'Unable to send OTP. Please wait and retry.';
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = 'Unable to send OTP. Please retry.';
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
        });
      }
    }
  }

  Future<void> _verifyOtp() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final token = widget.verifyPhoneCode != null
          ? await widget.verifyPhoneCode!(_verificationId!, _otp.text.trim())
          : await FirebasePhoneAuthService.instance.verifyProfilePhoneCode(
              verificationId: _verificationId!,
              smsCode: _otp.text.trim(),
            );
      await _profile.attachVerifiedFirebasePhone(token);
      if (!mounted) return;
      _verificationId = null;
      await _load();
    } on ProfileApiException catch (error) {
      if (mounted) {
        setState(() {
          _error = error.message;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = 'Phone verification failed. Check the code and retry.';
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
        });
      }
    }
  }

  Future<void> _continue() async {
    final state = _state;
    if (state == null || state.user['isPhoneVerified'] != true) return;
    final passed = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) =>
            AstrologerQualificationScreen(accessToken: state.accessToken),
      ),
    );
    if (!mounted || passed != true) return;
    try {
      final fresh = await _sessions.restore(
        portal: 'joinAstrologer',
        persist: false,
      );
      if (!mounted || fresh == null || fresh.user['isPhoneVerified'] != true) {
        return;
      }
      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => AstrologerRegistrationScreen(
            phone: fresh.user['phone'].toString(),
            accessToken: fresh.accessToken,
            canonicalEmail: fresh.user['email']?.toString(),
          ),
        ),
      );
      if (mounted) {
        await _load();
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = 'Unable to continue your application. Please retry.';
        });
      }
    }
  }

  Future<void> _openPortal(String portal) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final state = await _sessions.restore(portal: portal);
      if (state == null || !mounted) return;
      if (portal == 'astrologer' &&
          state.nextStep != 'OPEN_ASTROLOGER_DASHBOARD') {
        await _load();
        return;
      }
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute<void>(
          builder: (_) => portal == 'customer'
              ? const CustomerShellScreen()
              : const AstrologerDashboardScreen(),
        ),
        (_) => false,
      );
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = 'Unable to verify account access. Please retry.';
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final step = _state?.nextStep;
    return Scaffold(
      appBar: AppBar(title: const Text('Join as Astrologer')),
      body: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          if (_busy) const LinearProgressIndicator(),
          if (_error != null) ...[
            Text(_error!),
            TextButton(
              onPressed: _busy ? null : _load,
              child: const Text('Retry'),
            ),
          ],
          if (step == 'VERIFY_MOBILE_FOR_ASTROLOGER_ONBOARDING') ...[
            const Text('Verify your phone to continue your application.'),
            TextField(
              controller: _phone,
              readOnly: _verificationId != null,
              keyboardType: TextInputType.phone,
              decoration: const InputDecoration(
                labelText: 'Phone with country code',
              ),
            ),
            if (_verificationId == null)
              FilledButton(
                onPressed: _busy ? null : _sendOtp,
                child: const Text('Send OTP'),
              ),
            if (_verificationId != null) ...[
              TextField(
                controller: _otp,
                keyboardType: TextInputType.number,
                maxLength: 6,
                decoration: const InputDecoration(
                  labelText: 'SMS verification code',
                ),
              ),
              FilledButton(
                onPressed: _busy ? null : _verifyOtp,
                child: const Text('Verify and continue'),
              ),
            ],
          ],
          if (step == 'COMPLETE_ASTROLOGER_ONBOARDING') ...[
            const Text(
              'Continue your application using your existing account and verified phone.',
            ),
            FilledButton(
              onPressed: _busy ? null : _continue,
              child: const Text('Continue application'),
            ),
          ],
          if (step == 'WAIT_FOR_ADMIN_APPROVAL') ...[
            const Text(
              'Your application is under review. Astrologer access requires admin approval.',
            ),
            TextButton(
              onPressed: _busy ? null : _load,
              child: const Text('Refresh application status'),
            ),
          ],
          if (step == 'OPEN_ASTROLOGER_DASHBOARD')
            FilledButton(
              onPressed: _busy ? null : () => _openPortal('astrologer'),
              child: const Text('Open Astrologer Dashboard'),
            ),
          TextButton(
            onPressed: _busy ? null : () => _openPortal('customer'),
            child: const Text('Open Customer Dashboard'),
          ),
        ],
      ),
    );
  }
}
