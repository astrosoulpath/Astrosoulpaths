import 'dart:async';

import 'package:flutter/material.dart';

import '../../../subscription/presentation/screens/subscription_plans_screen.dart';

import '../../../../core/theme/app_theme.dart';
import 'astrologer_profile_screen.dart';
import 'astrologer_availability_screen.dart';
import 'astrologer_earnings_screen.dart';
import 'astrologer_customer_history_screen.dart';
import 'astrologer_consultations_screen.dart';
import '../../../auth/data/auth_session_store.dart';
import '../../../calling/data/video_call_socket_service.dart';
import '../../../calling/data/audio_call_socket_service.dart';
import '../../../calling/presentation/screens/video_call_screen.dart';
import '../../../calling/presentation/screens/audio_call_screen.dart';
import '../../data/astrologer_consultations_api.dart';
import '../../../auth/presentation/auth_gate.dart';
import '../../data/astrologer_portal_api.dart';
import '../../../live/presentation/screens/astrologer_live_screen.dart';
import '../../../kundli/presentation/screens/astrologer_saved_kundlis_screen.dart';
import '../../../marketplace/presentation/screens/marketplace_seller_home_screen.dart';
import '../../../kundli/presentation/screens/astrologer_manual_kundli_reports_screen.dart';

class AstrologerDashboardScreen extends StatefulWidget {
  const AstrologerDashboardScreen({super.key});

  @override
  State<AstrologerDashboardScreen> createState() =>
      _AstrologerDashboardScreenState();
}

class _AstrologerDashboardScreenState extends State<AstrologerDashboardScreen> {
  Future<void> _openKundliSubscriptionGate({
    required Widget unlockedScreen,
  }) async {
    try {
      await Navigator.of(
        context,
      ).push(MaterialPageRoute<void>(builder: (_) => unlockedScreen));

      if (mounted) {
        await _loadDashboard();
      }
    } catch (_) {
      if (!mounted) {
        return;
      }

      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => const SubscriptionPlansScreen(
            audience: SubscriptionAudience.astrologer,
          ),
        ),
      );

      if (mounted) {
        await _loadDashboard();
      }
    }
  }

  final _api = AstrologerPortalApi();
  final _sessionStore = AuthSessionStore();
  final VideoCallSocketService _videoCallSocket = VideoCallSocketService();
  final AudioCallSocketService _audioCallSocket = AudioCallSocketService();
  final AstrologerConsultationsApi _videoConsultationApi =
      AstrologerConsultationsApi();
  bool _incomingVideoDialogOpen = false;
  String _incomingVideoCallId = '';

  final Set<String> _terminalIncomingVideoCallIds = <String>{};
  String _callSocketUserId = '';

  Timer? _dashboardPollTimer;
  bool _dashboardPolling = false;
  bool _loading = true;
  bool _statusUpdating = false;
  bool _isLoggingOut = false;
  String _error = '';

  Map<String, dynamic> _dashboard = <String, dynamic>{};

  @override
  void initState() {
    super.initState();

    _loadDashboard();
    unawaited(_startVideoCallSocket());
    unawaited(_startAudioCallSocket());

    _dashboardPollTimer = Timer.periodic(
      const Duration(seconds: 3),
      (_) => _refreshDashboardSilently(),
    );
  }

  @override
  void dispose() {
    _dashboardPollTimer?.cancel();
    _videoCallSocket.dispose();
    _audioCallSocket.dispose();
    _videoConsultationApi.close();
    _api.close();
    super.dispose();
  }

  bool _incomingAudioDialogOpen = false;
  String _incomingAudioCallId = '';
  // ignore: prefer_final_fields
  String _audioSocketUserId = '';
  final Set<String> _terminalIncomingAudioCallIds = <String>{};
  Future<void> _startAudioCallSocket() async {
    final session = await _sessionStore.read();

    if (!mounted || session == null) {
      return;
    }

    final user = session.user;

    final userId = user['id']?.toString().trim().isNotEmpty == true
        ? user['id'].toString().trim()
        : user['userId']?.toString().trim() ?? '';

    if (userId.isEmpty) {
      return;
    }

    _audioCallSocket.connect(
      userId: userId,
      accessToken: session.accessToken,
      onIncoming: (payload) {
        final type =
            payload['consultationType']?.toString().trim().toUpperCase() ?? '';

        if (type != 'AUDIO') {
          return;
        }

        debugPrint(
          'AUDIO_INCOMING_RECEIVED '
          'callId=${payload['callId'] ?? payload['consultationId']}',
        );

        unawaited(_showIncomingAudioCall(payload));
      },
      onMissed: (payload) {
        final callId =
            (payload['callId'] ?? payload['consultationId'])
                ?.toString()
                .trim() ??
            '';

        final isStillRinging =
            callId.isNotEmpty &&
            _incomingAudioDialogOpen &&
            _incomingAudioCallId == callId;

        if (!isStillRinging) {
          debugPrint(
            'AUDIO_INCOMING_MISSED_IGNORED '
            'callId= reason=NOT_RINGING_OR_ALREADY_ACCEPTED',
          );
          return;
        }

        debugPrint('AUDIO_INCOMING_MISSED callId=');
        _closeTerminalIncomingAudioCall(payload, reason: 'MISSED');
      },
      onCancelled: (payload) {
        debugPrint(
          'AUDIO_INCOMING_CANCELLED '
          'callId=${payload['callId'] ?? payload['consultationId']}',
        );
        _closeTerminalIncomingAudioCall(payload, reason: 'CANCELLED');
      },
      onUnavailable: (payload) {
        debugPrint(
          'AUDIO_INCOMING_UNAVAILABLE '
          'callId=${payload['callId'] ?? payload['consultationId']}',
        );
        _closeTerminalIncomingAudioCall(payload, reason: 'UNAVAILABLE');
      },
    );
  }

  void _closeTerminalIncomingAudioCall(
    Map<String, dynamic> payload, {
    required String reason,
  }) {
    final callId = payload['callId']?.toString().trim().isNotEmpty == true
        ? payload['callId'].toString().trim()
        : payload['consultationId']?.toString().trim() ?? '';

    if (callId.isEmpty) {
      return;
    }

    _terminalIncomingAudioCallIds.add(callId);

    debugPrint('AUDIO_INCOMING_TERMINAL callId=$callId reason=$reason');

    if (!mounted ||
        !_incomingAudioDialogOpen ||
        _incomingAudioCallId != callId) {
      return;
    }

    Navigator.of(context).pop();
  }

  Future<void> _showIncomingAudioCall(Map<String, dynamic> payload) async {
    if (!mounted || _incomingAudioDialogOpen) {
      return;
    }

    final callId = payload['callId']?.toString().trim().isNotEmpty == true
        ? payload['callId'].toString().trim()
        : payload['consultationId']?.toString().trim() ?? '';

    final callerUserId =
        payload['callerUserId']?.toString().trim().isNotEmpty == true
        ? payload['callerUserId'].toString().trim()
        : payload['callerId']?.toString().trim() ?? '';

    final callerName =
        payload['callerName']?.toString().trim().isNotEmpty == true
        ? payload['callerName'].toString().trim()
        : 'Customer';

    if (callId.isEmpty || callerUserId.isEmpty || _audioSocketUserId.isEmpty) {
      return;
    }

    if (_terminalIncomingAudioCallIds.contains(callId)) {
      debugPrint('AUDIO_INCOMING_IGNORED_TERMINAL callId=$callId');
      return;
    }

    _incomingAudioCallId = callId;
    _incomingAudioDialogOpen = true;

    final accepted = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.call_rounded),
            SizedBox(width: 10),
            Expanded(child: Text('Incoming Audio Call')),
          ],
        ),
        content: Text('$callerName is requesting an audio consultation.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Decline'),
          ),
          FilledButton.icon(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            icon: const Icon(Icons.call_rounded),
            label: const Text('Accept'),
          ),
        ],
      ),
    );

    _incomingAudioDialogOpen = false;
    _incomingAudioCallId = '';

    if (!mounted) {
      return;
    }

    if (accepted == null) {
      await _refreshDashboardSilently();
      return;
    }

    if (accepted != true) {
      try {
        await _videoConsultationApi.reject(callId);
      } catch (_) {}

      _audioCallSocket.reject(
        callId: callId,
        callerUserId: callerUserId,
        receiverUserId: _audioSocketUserId,
      );

      await _refreshDashboardSilently();
      return;
    }

    if (_terminalIncomingAudioCallIds.contains(callId)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('This audio call request is no longer available.'),
        ),
      );

      await _refreshDashboardSilently();
      return;
    }

    try {
      final response = await _videoConsultationApi.accept(callId);

      if (_terminalIncomingAudioCallIds.contains(callId)) {
        await _refreshDashboardSilently();
        return;
      }

      final data = response['data'];

      String audioCallSessionId = callId;

      if (data is Map) {
        final result = Map<String, dynamic>.from(data);
        final call = result['call'];

        if (call is Map) {
          final callMap = Map<String, dynamic>.from(call);

          final resolved =
              callMap['callSessionId']?.toString().trim().isNotEmpty == true
              ? callMap['callSessionId'].toString().trim()
              : callMap['id']?.toString().trim() ?? '';

          if (resolved.isNotEmpty) {
            audioCallSessionId = resolved;
          }
        }
      }

      _audioCallSocket.accept(
        callId: callId,
        callerUserId: callerUserId,
        receiverUserId: _audioSocketUserId,
      );

      if (!mounted) {
        return;
      }

      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => AudioCallScreen(
            callId: audioCallSessionId,
            astrologerName: callerName,
          ),
        ),
      );

      await _loadDashboard();
    } on AstrologerConsultationsApiException catch (error) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(
          SnackBar(content: Text(error.message), backgroundColor: Colors.red),
        );
    }
  }

  Future<void> _startVideoCallSocket() async {
    final session = await _sessionStore.read();

    if (!mounted || session == null) {
      return;
    }

    final user = session.user;

    final userId = user['id']?.toString().trim().isNotEmpty == true
        ? user['id'].toString().trim()
        : user['userId']?.toString().trim() ?? '';

    if (userId.isEmpty) {
      return;
    }

    _callSocketUserId = userId;

    _videoCallSocket.connect(
      userId: userId,
      accessToken: session.accessToken,
      onIncoming: (payload) {
        final type =
            payload['consultationType']?.toString().trim().toUpperCase() ?? '';

        if (type != 'VIDEO') {
          return;
        }

        unawaited(_showIncomingVideoCall(payload));
      },

      onMissed: (payload) {
        _closeTerminalIncomingVideoCall(payload, reason: 'MISSED');
      },

      onCancelled: (payload) {
        _closeTerminalIncomingVideoCall(payload, reason: 'CANCELLED');
      },

      onUnavailable: (payload) {
        _closeTerminalIncomingVideoCall(payload, reason: 'UNAVAILABLE');
      },
    );
  }

  void _closeTerminalIncomingVideoCall(
    Map<String, dynamic> payload, {
    required String reason,
  }) {
    final callId = payload['callId']?.toString().trim().isNotEmpty == true
        ? payload['callId'].toString().trim()
        : payload['consultationId']?.toString().trim() ?? '';

    if (callId.isEmpty) {
      return;
    }

    _terminalIncomingVideoCallIds.add(callId);

    debugPrint('VIDEO_INCOMING_TERMINAL callId=$callId reason=$reason');

    if (!mounted ||
        !_incomingVideoDialogOpen ||
        _incomingVideoCallId != callId) {
      return;
    }

    Navigator.of(context).pop();

    debugPrint(
      'VIDEO_INCOMING_DIALOG_AUTO_CLOSED '
      'callId=$callId reason=$reason',
    );
  }

  Future<void> _showIncomingVideoCall(Map<String, dynamic> payload) async {
    if (!mounted || _incomingVideoDialogOpen) {
      return;
    }

    final callId = payload['callId']?.toString().trim() ?? '';

    final callerUserId =
        payload['callerUserId']?.toString().trim().isNotEmpty == true
        ? payload['callerUserId'].toString().trim()
        : payload['callerId']?.toString().trim() ?? '';

    final callerName =
        payload['callerName']?.toString().trim().isNotEmpty == true
        ? payload['callerName'].toString().trim()
        : 'Customer';

    if (callId.isEmpty || callerUserId.isEmpty || _callSocketUserId.isEmpty) {
      return;
    }

    if (_terminalIncomingVideoCallIds.contains(callId)) {
      debugPrint('VIDEO_INCOMING_IGNORED_TERMINAL callId=$callId');
      return;
    }

    _incomingVideoCallId = callId;
    _incomingVideoDialogOpen = true;

    final accepted = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (dialogContext) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.videocam_rounded),
            SizedBox(width: 10),
            Expanded(child: Text('Incoming Video Call')),
          ],
        ),
        content: Text('$callerName is requesting a video consultation.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Decline'),
          ),
          FilledButton.icon(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            icon: const Icon(Icons.videocam_rounded),
            label: const Text('Accept'),
          ),
        ],
      ),
    );

    _incomingVideoDialogOpen = false;
    _incomingVideoCallId = '';

    if (!mounted) {
      return;
    }

    if (accepted == null) {
      debugPrint('VIDEO_INCOMING_SYSTEM_DISMISSED callId=$callId');

      await _refreshDashboardSilently();
      return;
    }

    if (accepted != true) {
      try {
        await _videoConsultationApi.reject(callId);
      } catch (_) {}

      _videoCallSocket.reject(
        callId: callId,
        callerUserId: callerUserId,
        receiverUserId: _callSocketUserId,
      );

      await _refreshDashboardSilently();
      return;
    }
    if (_terminalIncomingVideoCallIds.contains(callId)) {
      debugPrint('VIDEO_LATE_ACCEPT_BLOCKED callId=$callId');

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('This video call request is no longer available.'),
        ),
      );

      await _refreshDashboardSilently();
      return;
    }

    try {
      final response = await _videoConsultationApi.accept(callId);

      if (_terminalIncomingVideoCallIds.contains(callId)) {
        debugPrint('VIDEO_ACCEPT_RESPONSE_IGNORED_TERMINAL callId=$callId');

        await _refreshDashboardSilently();
        return;
      }

      final data = response['data'];

      String videoCallSessionId = callId;

      if (data is Map) {
        final result = Map<String, dynamic>.from(data);
        final call = result['call'];

        if (call is Map) {
          final callMap = Map<String, dynamic>.from(call);

          final resolved =
              callMap['callSessionId']?.toString().trim().isNotEmpty == true
              ? callMap['callSessionId'].toString().trim()
              : callMap['id']?.toString().trim() ?? '';

          if (resolved.isNotEmpty) {
            videoCallSessionId = resolved;
          }
        }
      }

      _videoCallSocket.accept(
        callId: callId,
        callerUserId: callerUserId,
        receiverUserId: _callSocketUserId,
      );

      if (!mounted) {
        return;
      }

      await Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => VideoCallScreen(
            callId: videoCallSessionId,
            participantName: callerName,
          ),
        ),
      );

      await _loadDashboard();
    } on AstrologerConsultationsApiException catch (error) {
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
    }
  }

  Future<String> _accessToken() async {
    final session = await _sessionStore.read();
    return session?.accessToken.trim() ?? '';
  }

  Map<String, dynamic> _data(Map<String, dynamic> response) {
    final value = response['data'];

    if (value is Map<String, dynamic>) {
      return value;
    }

    if (value is Map) {
      return Map<String, dynamic>.from(value);
    }

    return response;
  }

  List<String> _strings(dynamic source) {
    if (source is! List) {
      return const [];
    }

    return source
        .map((item) => item.toString().trim())
        .where((item) => item.isNotEmpty)
        .toList();
  }

  Future<void> _loadDashboard() async {
    if (mounted) {
      setState(() {
        _loading = true;
        _error = '';
      });
    }

    try {
      final token = await _accessToken();

      if (token.isEmpty) {
        throw const AstrologerPortalApiException(
          'Login session not found. Please login again.',
        );
      }

      final response = await _api.getDashboard(accessToken: token);

      if (!mounted) {
        return;
      }

      setState(() {
        _dashboard = _data(response);
      });
    } on AstrologerPortalApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _error = error.message;
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  Future<void> _refreshDashboardSilently() async {
    if (!mounted || _dashboardPolling || _statusUpdating) {
      return;
    }

    final route = ModalRoute.of(context);

    if (route != null && !route.isCurrent) {
      return;
    }

    _dashboardPolling = true;

    try {
      final token = await _accessToken();

      if (token.isEmpty) {
        return;
      }

      final response = await _api.getDashboard(accessToken: token);

      if (!mounted) {
        return;
      }

      setState(() {
        _dashboard = _data(response);
      });
    } on AstrologerPortalApiException {
      // Keep the last valid dashboard state during background refresh.
    } finally {
      _dashboardPolling = false;
    }
  }

  Future<void> _setOnline(bool value) async {
    if (_statusUpdating) {
      return;
    }

    final previous = _dashboard['isOnline'] == true;

    setState(() {
      _statusUpdating = true;
      _dashboard = {..._dashboard, 'isOnline': value};
    });

    try {
      final token = await _accessToken();

      await _api.updateStatus(accessToken: token, isOnline: value);

      await _loadDashboard();
    } on AstrologerPortalApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _dashboard = {..._dashboard, 'isOnline': previous};
      });

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
          _statusUpdating = false;
        });
      }
    }
  }

  Future<void> _logout() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Logout'),
        content: const Text(
          'Are you sure you want to logout from your astrologer account?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('Logout'),
          ),
        ],
      ),
    );

    if (confirmed != true || !mounted) {
      return;
    }

    setState(() {
      _isLoggingOut = true;
    });

    _dashboardPollTimer?.cancel();

    await _sessionStore.clear();

    if (!mounted) {
      return;
    }

    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute<void>(builder: (_) => const AuthGate()),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return Scaffold(
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        body: Center(child: CircularProgressIndicator(color: AppColors.gold)),
      );
    }

    if (_error.isNotEmpty) {
      return Scaffold(
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        body: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.error_outline_rounded,
                    color: AppColors.gold,
                    size: 48,
                  ),
                  const SizedBox(height: 16),
                  Text(
                    _error,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: AppColors.white),
                  ),
                  const SizedBox(height: 18),
                  FilledButton(
                    onPressed: _loadDashboard,
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    final isOnline = _dashboard['isOnline'] == true;
    final isApproved = _dashboard['isApproved'] == true;
    final isVerified = _dashboard['isVerified'] == true;

    final profileCompletion =
        int.tryParse(_dashboard['profileCompletion']?.toString() ?? '') ?? 0;

    final pendingConsultations =
        int.tryParse(_dashboard['pendingConsultations']?.toString() ?? '') ?? 0;

    final experience =
        int.tryParse(_dashboard['experience']?.toString() ?? '') ?? 0;

    final price =
        double.tryParse(_dashboard['pricePerMin']?.toString() ?? '') ?? 0;

    final languages = _strings(_dashboard['languages']);
    final expertise = _strings(_dashboard['expertise']);

    final astrologerName =
        _dashboard['name']?.toString().trim().isNotEmpty == true
        ? _dashboard['name'].toString().trim()
        : 'Astro Soul Path Astrologer';

    final avatarUrl = _dashboard['avatarUrl']?.toString().trim() ?? '';

    final rating = double.tryParse(_dashboard['rating']?.toString() ?? '') ?? 0;

    final earnings =
        double.tryParse(_dashboard['earnings']?.toString() ?? '') ?? 0;

    final todayCalls =
        int.tryParse(_dashboard['todayCalls']?.toString() ?? '') ?? 0;

    final todayChats =
        int.tryParse(_dashboard['todayChats']?.toString() ?? '') ?? 0;

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        automaticallyImplyLeading: false,
        backgroundColor: AppColors.background,
        foregroundColor: AppColors.white,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Astrologer Dashboard',
              style: TextStyle(fontWeight: FontWeight.w900),
            ),
            Text(
              'Professional Astrologer Partner',
              style: TextStyle(color: AppColors.gold, fontSize: 11),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _loadDashboard,
            icon: const Icon(Icons.refresh_rounded),
          ),
          IconButton(
            tooltip: 'Logout',
            onPressed: _isLoggingOut ? null : _logout,
            icon: _isLoggingOut
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: AppColors.gold,
                    ),
                  )
                : const Icon(Icons.logout_rounded),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadDashboard,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 36),
          children: [
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: const Color(0x44F4C45E)),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      Container(
                        width: 70,
                        height: 70,
                        padding: const EdgeInsets.all(2),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: AppColors.gold, width: 2),
                          boxShadow: const [
                            BoxShadow(
                              color: Color(0x44F4C45E),
                              blurRadius: 18,
                              spreadRadius: 1,
                            ),
                          ],
                        ),
                        child: CircleAvatar(
                          backgroundColor: AppColors.surfaceLight,
                          backgroundImage: avatarUrl.isNotEmpty
                              ? NetworkImage(avatarUrl)
                              : null,
                          child: avatarUrl.isEmpty
                              ? const Icon(
                                  Icons.person_rounded,
                                  color: AppColors.gold,
                                  size: 34,
                                )
                              : null,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Flexible(
                                  child: Text(
                                    astrologerName,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: AppColors.white,
                                      fontSize: 20,
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                ),
                                if (isVerified) ...[
                                  const SizedBox(width: 6),
                                  const Icon(
                                    Icons.verified_rounded,
                                    color: AppColors.gold,
                                    size: 20,
                                  ),
                                ],
                              ],
                            ),
                            const SizedBox(height: 6),
                            Row(
                              children: [
                                const Icon(
                                  Icons.star_rounded,
                                  color: AppColors.gold,
                                  size: 17,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  rating > 0
                                      ? rating.toStringAsFixed(1)
                                      : 'New',
                                  style: const TextStyle(
                                    color: AppColors.white,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Flexible(
                                  child: Text(
                                    '$experience yrs experience',
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      color: AppColors.muted,
                                      fontSize: 12,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 7),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 9,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: isApproved && isVerified
                                    ? const Color(0x1834D399)
                                    : const Color(0x18F4C45E),
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Text(
                                isApproved && isVerified
                                    ? 'Verified Astrologer'
                                    : 'Verification Pending',
                                style: TextStyle(
                                  color: isApproved && isVerified
                                      ? Colors.greenAccent
                                      : AppColors.gold,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          isOnline ? 'You are Online' : 'You are Offline',
                          style: const TextStyle(
                            color: AppColors.white,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      if (_statusUpdating)
                        const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: AppColors.gold,
                          ),
                        )
                      else
                        Switch(
                          value: isOnline,
                          onChanged: isApproved && isVerified
                              ? _setOnline
                              : null,
                        ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 18),

            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0x33F4C45E)),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: _MetricCard(
                      label: 'Total Earnings',
                      value: '\u20B9${earnings.toStringAsFixed(2)}',
                      icon: Icons.account_balance_wallet_rounded,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _MetricCard(
                      label: 'Audio Calls',
                      value: '$todayCalls',
                      icon: Icons.call_rounded,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _MetricCard(
                      label: 'Chats',
                      value: '$todayChats',
                      icon: Icons.chat_bubble_rounded,
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 18),

            Row(
              children: [
                Expanded(
                  child: _MetricCard(
                    label: 'Profile',
                    value: '$profileCompletion%',
                    icon: Icons.person_outline_rounded,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _MetricCard(
                    label: 'Pending',
                    value: '$pendingConsultations',
                    icon: Icons.schedule_rounded,
                  ),
                ),
              ],
            ),

            const SizedBox(height: 10),

            Row(
              children: [
                Expanded(
                  child: _MetricCard(
                    label: 'Experience',
                    value: '$experience yr',
                    icon: Icons.workspace_premium_outlined,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: _MetricCard(
                    label: 'Price',
                    value: '\u20B9${price.toStringAsFixed(0)}/min',
                    icon: Icons.currency_rupee_rounded,
                  ),
                ),
              ],
            ),

            if (languages.isNotEmpty) ...[
              const SizedBox(height: 20),
              _InfoSection(title: 'Languages', values: languages),
            ],

            if (expertise.isNotEmpty) ...[
              const SizedBox(height: 14),
              _InfoSection(title: 'Astrologer Type', values: expertise),
            ],

            const SizedBox(height: 24),
            Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                const Expanded(
                  child: Text(
                    'Partner tools',
                    style: TextStyle(
                      color: AppColors.white,
                      fontSize: 22,
                      fontWeight: FontWeight.w900,
                      height: 1.05,
                      letterSpacing: -0.35,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: AppColors.gold.withValues(alpha: 0.11),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: AppColors.gold.withValues(alpha: 0.30),
                    ),
                  ),
                  child: const Text(
                    'Serve • Guide • Grow',
                    style: TextStyle(
                      color: AppColors.gold,
                      fontSize: 9.8,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.15,
                    ),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 12),

            _DashboardItem(
              icon: Icons.chat_bubble_outline_rounded,
              title: 'Consultations',
              subtitle: 'Queue, chat, audio calls and chat history',
              onTap: () async {
                await Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => const AstrologerConsultationsScreen(),
                  ),
                );

                if (context.mounted) {
                  await _loadDashboard();
                }
              },
            ),
            _DashboardItem(
              icon: Icons.person_outline_rounded,
              title: 'Profile',
              subtitle: 'Profile, languages and expertise',
              onTap: () async {
                await Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => const AstrologerProfileScreen(),
                  ),
                );

                if (context.mounted) {
                  await _loadDashboard();
                }
              },
            ),
            _DashboardItem(
              icon: Icons.live_tv_rounded,
              title: 'Go Live',
              subtitle: isApproved && isVerified
                  ? 'Start a live video session'
                  : 'Approval and verification required',
              onTap: isApproved && isVerified
                  ? () async {
                      await Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => const AstrologerLiveScreen(),
                        ),
                      );

                      if (context.mounted) {
                        await _loadDashboard();
                      }
                    }
                  : null,
            ),
            _DashboardItem(
              icon: Icons.currency_rupee_rounded,
              title: 'Pricing',
              subtitle: 'Manage consultation price',
              onTap: () async {
                await Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => const AstrologerProfileScreen(),
                  ),
                );

                if (context.mounted) {
                  await _loadDashboard();
                }
              },
            ),
            _DashboardItem(
              icon: Icons.calendar_month_outlined,
              title: 'Availability',
              subtitle: 'Online status and availability schedule',
              onTap: () async {
                await Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => const AstrologerAvailabilityScreen(),
                  ),
                );

                if (context.mounted) {
                  await _loadDashboard();
                }
              },
            ),
            _DashboardItem(
              icon: Icons.account_balance_wallet_outlined,
              title: 'Earnings',
              subtitle: 'Income, transactions and payments',
              onTap: () async {
                await Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => const AstrologerEarningsScreen(),
                  ),
                );

                if (context.mounted) {
                  await _loadDashboard();
                }
              },
            ),
            _DashboardItem(
              icon: Icons.people_outline_rounded,
              title: 'Customer History',
              subtitle: 'Previous customers and consultations',
              onTap: () async {
                await Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => const AstrologerCustomerHistoryScreen(),
                  ),
                );

                if (context.mounted) {
                  await _loadDashboard();
                }
              },
            ),
            _DashboardItem(
              icon: Icons.auto_awesome_outlined,
              title: 'Kundali',
              subtitle: 'Prepare and manage professional Kundli reports',
              onTap: () async {
                await _openKundliSubscriptionGate(
                  unlockedScreen: const AstrologerManualKundliReportsScreen(),
                );
              },
            ),
            _DashboardItem(
              icon: Icons.description_outlined,
              title: 'Reports',
              subtitle: 'Access generated astrology reports',
              onTap: () async {
                await _openKundliSubscriptionGate(
                  unlockedScreen: const AstrologerSavedKundlisScreen(),
                );
              },
            ),
            _DashboardItem(
              icon: Icons.workspace_premium_outlined,
              title: 'Subscription',
              subtitle: 'Subscription and plan status',
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => const SubscriptionPlansScreen(
                      audience: SubscriptionAudience.astrologer,
                    ),
                  ),
                );
              },
            ),
            _DashboardItem(
              icon: Icons.storefront_outlined,
              title: 'Soul Bazaar Seller',
              subtitle: 'Manage your marketplace profile and products',
              onTap: () async {
                await Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => const MarketplaceSellerHomeScreen(),
                  ),
                );

                if (context.mounted) {
                  await _loadDashboard();
                }
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.label,
    required this.value,
    required this.icon,
  });

  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minHeight: 122),
      padding: const EdgeInsets.fromLTRB(13, 13, 13, 14),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFF171717), Color(0xFF101113)],
        ),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: AppColors.gold.withValues(alpha: 0.60),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.gold.withValues(alpha: 0.16),
            blurRadius: 18,
            spreadRadius: 1,
            offset: const Offset(0, 6),
          ),
          const BoxShadow(
            color: Color(0x35000000),
            blurRadius: 14,
            offset: Offset(0, 7),
          ),
        ],
      ),
      child: Stack(
        children: [
          Positioned(
            top: -30,
            right: -25,
            child: Container(
              width: 75,
              height: 75,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.gold.withValues(alpha: 0.025),
              ),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [
                      AppColors.gold.withValues(alpha: 0.34),
                      AppColors.gold.withValues(alpha: 0.08),
                    ],
                  ),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: AppColors.gold.withValues(alpha: 0.14),
                  ),
                ),
                alignment: Alignment.center,
                child: Icon(icon, color: AppColors.gold, size: 20),
              ),
              const SizedBox(height: 11),
              FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: Text(
                  value,
                  maxLines: 1,
                  style: const TextStyle(
                    color: AppColors.white,
                    fontSize: 21,
                    fontWeight: FontWeight.w900,
                    height: 1,
                    letterSpacing: -0.3,
                  ),
                ),
              ),
              const SizedBox(height: 7),
              Text(
                label,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  color: Color(0xFFB4B4B4),
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  height: 1.25,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _InfoSection extends StatelessWidget {
  const _InfoSection({required this.title, required this.values});

  final String title;
  final List values;

  @override
  Widget build(BuildContext context) {
    final isLanguages = title.toLowerCase().contains('language');
    final isAstrologerType =
        title.toLowerCase().contains('astrologer type') ||
        title.toLowerCase().contains('expertise');

    final displayValues = values
        .map((value) => value.toString().trim())
        .where((value) => value.isNotEmpty)
        .toList(growable: false);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(17, 16, 17, 17),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: isAstrologerType
              ? const [Color(0xFF17131E), Color(0xFF121214)]
              : const [Color(0xFF151617), Color(0xFF101112)],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: AppColors.gold.withValues(
            alpha: isAstrologerType ? 0.72 : 0.48,
          ),
        ),
        boxShadow: [
          BoxShadow(
            color: isAstrologerType
                ? AppColors.gold.withValues(alpha: 0.055)
                : const Color(0x22000000),
            blurRadius: 18,
            offset: const Offset(0, 7),
          ),
        ],
      ),
      child: Stack(
        children: [
          if (isAstrologerType)
            Positioned(
              right: -25,
              top: -28,
              child: Icon(
                Icons.auto_awesome_rounded,
                size: 100,
                color: AppColors.gold.withValues(alpha: 0.035),
              ),
            ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: AppColors.gold.withValues(alpha: 0.16),
                      borderRadius: BorderRadius.circular(13),
                      border: Border.all(
                        color: AppColors.gold.withValues(alpha: 0.18),
                      ),
                    ),
                    alignment: Alignment.center,
                    child: Icon(
                      isLanguages
                          ? Icons.language_rounded
                          : Icons.auto_awesome_rounded,
                      color: AppColors.gold,
                      size: 21,
                    ),
                  ),
                  const SizedBox(width: 11),
                  Expanded(
                    child: Text(
                      title,
                      style: const TextStyle(
                        color: AppColors.white,
                        fontSize: 17,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              if (displayValues.isEmpty)
                const Text(
                  'Not added yet',
                  style: TextStyle(color: AppColors.muted, fontSize: 12),
                )
              else
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: displayValues
                      .map((value) {
                        return Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 8,
                          ),
                          decoration: BoxDecoration(
                            color: isAstrologerType
                                ? AppColors.gold.withValues(alpha: 0.16)
                                : const Color(0xFF1D1D1D),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: AppColors.gold.withValues(
                                alpha: isAstrologerType ? 0.70 : 0.48,
                              ),
                            ),
                          ),
                          child: Text(
                            value,
                            style: TextStyle(
                              color: isAstrologerType
                                  ? AppColors.gold
                                  : AppColors.white,
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        );
                      })
                      .toList(growable: false),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _DashboardItem extends StatelessWidget {
  const _DashboardItem({
    required this.icon,
    required this.title,
    required this.subtitle,
    this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;

  Color _accentColor() {
    switch (title) {
      case 'Profile':
        return const Color(0xFFBC5CFF);

      case 'Go Live':
        return const Color(0xFF00D8C5);

      case 'Pricing':
        return const Color(0xFFFFA800);

      case 'Availability':
        return const Color(0xFF459DFF);

      case 'Earnings':
        return const Color(0xFF00C98D);

      case 'Customer History':
        return const Color(0xFFC85EFF);

      case 'Kundali':
        return const Color(0xFFFFC400);

      case 'Reports':
        return const Color(0xFFFFB900);

      case 'Soul Bazaar Seller':
        return const Color(0xFFFFA000);

      case 'Consultations':
      default:
        return const Color(0xFFFFD000);
    }
  }

  Color _deepColor() {
    switch (title) {
      case 'Profile':
        return const Color(0xFF301047);

      case 'Go Live':
        return const Color(0xFF003D3A);

      case 'Pricing':
        return const Color(0xFF4B2700);

      case 'Availability':
        return const Color(0xFF072D58);

      case 'Earnings':
        return const Color(0xFF063C2E);

      case 'Customer History':
        return const Color(0xFF351044);

      case 'Kundali':
        return const Color(0xFF3F3000);

      case 'Reports':
        return const Color(0xFF403000);

      case 'Soul Bazaar Seller':
        return const Color(0xFF442600);

      case 'Consultations':
      default:
        return const Color(0xFF443400);
    }
  }

  IconData _backgroundIcon() {
    switch (title) {
      case 'Profile':
        return Icons.person_rounded;

      case 'Go Live':
        return Icons.live_tv_rounded;

      case 'Pricing':
        return Icons.currency_rupee_rounded;

      case 'Availability':
        return Icons.calendar_month_rounded;

      case 'Earnings':
        return Icons.bar_chart_rounded;

      case 'Customer History':
        return Icons.groups_rounded;

      case 'Kundali':
        return Icons.auto_awesome_rounded;

      case 'Reports':
        return Icons.description_rounded;

      case 'Soul Bazaar Seller':
        return Icons.storefront_rounded;

      case 'Consultations':
      default:
        return Icons.chat_bubble_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    final enabled = onTap != null;

    final accent = _accentColor();
    final deep = _deepColor();

    return Padding(
      padding: const EdgeInsets.only(bottom: 11),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(21),
          child: Ink(
            padding: const EdgeInsets.fromLTRB(14, 13, 12, 13),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.centerLeft,
                end: Alignment.centerRight,
                colors: enabled
                    ? [
                        deep,
                        accent.withValues(alpha: 0.19),
                        const Color(0xFF111214),
                      ]
                    : const [Color(0xFF171717), Color(0xFF111111)],
                stops: enabled ? const [0.0, 0.43, 1.0] : const [0.0, 1.0],
              ),
              borderRadius: BorderRadius.circular(21),
              border: Border.all(
                color: enabled
                    ? accent.withValues(alpha: 0.88)
                    : AppColors.muted.withValues(alpha: 0.20),
                width: 1.15,
              ),
              boxShadow: enabled
                  ? [
                      BoxShadow(
                        color: accent.withValues(alpha: 0.16),
                        blurRadius: 18,
                        spreadRadius: 0.3,
                        offset: const Offset(0, 5),
                      ),
                      const BoxShadow(
                        color: Color(0x66000000),
                        blurRadius: 15,
                        offset: Offset(0, 8),
                      ),
                    ]
                  : null,
            ),
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Positioned(
                  right: 44,
                  top: -22,
                  child: Icon(
                    _backgroundIcon(),
                    size: 105,
                    color: accent.withValues(alpha: 0.085),
                  ),
                ),

                Row(
                  children: [
                    Container(
                      width: 55,
                      height: 55,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: RadialGradient(
                          colors: [accent.withValues(alpha: 0.50), deep],
                        ),
                        border: Border.all(
                          color: accent.withValues(alpha: 0.90),
                          width: 1.2,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: accent.withValues(alpha: 0.32),
                            blurRadius: 15,
                            spreadRadius: 1,
                          ),
                        ],
                      ),
                      alignment: Alignment.center,
                      child: Icon(
                        icon,
                        color: enabled ? accent : AppColors.muted,
                        size: 25,
                      ),
                    ),

                    const SizedBox(width: 14),

                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: enabled
                                  ? AppColors.white
                                  : AppColors.muted,
                              fontSize: 15.5,
                              fontWeight: FontWeight.w900,
                              letterSpacing: -0.1,
                            ),
                          ),

                          const SizedBox(height: 5),

                          Text(
                            subtitle,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: enabled
                                  ? const Color(0xFFC9C9C9)
                                  : AppColors.muted,
                              fontSize: 11.2,
                              height: 1.30,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(width: 9),

                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: accent.withValues(alpha: 0.18),
                        border: Border.all(
                          color: accent.withValues(alpha: 0.45),
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: accent.withValues(alpha: 0.16),
                            blurRadius: 8,
                          ),
                        ],
                      ),
                      alignment: Alignment.center,
                      child: Icon(
                        Icons.chevron_right_rounded,
                        color: accent,
                        size: 25,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
