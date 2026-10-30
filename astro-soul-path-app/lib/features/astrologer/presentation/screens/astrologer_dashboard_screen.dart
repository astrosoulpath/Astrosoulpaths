import '../../../support/data/support_operations_config.dart';
import '../../../support/presentation/screens/support_home_screen.dart';
import '../../data/earnings_currency.dart';
import '../../../auth/data/secure_logout.dart';
import 'dart:async';
import '../widgets/partner_dashboard_widgets.dart';

import 'package:flutter/material.dart';
import '../../../notifications/presentation/screens/subscription_notifications_screen.dart';

import '../../../subscription/presentation/screens/subscription_plans_screen.dart';

import '../../../../core/theme/app_theme.dart';
import 'astrologer_profile_screen.dart';
import 'astrologer_availability_screen.dart';
import 'astrologer_earnings_screen.dart';
import 'astrologer_customer_history_screen.dart';
import 'astrologer_consultations_screen.dart';
import '../../../articles/presentation/screens/astrologer_articles_screen.dart';
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

class _AstrologerDashboardScreenState extends State<AstrologerDashboardScreen>
    with WidgetsBindingObserver {
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

      // Destination APIs enforce entitlement. An arbitrary navigation failure
      // is not evidence that a subscription purchase is required.
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Unable to open reports. Please retry.')),
      );
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
  String _refreshWarning = '';
  int _dashboardRevision = 0;

  Map<String, dynamic> _dashboard = <String, dynamic>{};

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);

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
    WidgetsBinding.instance.removeObserver(this);
    _dashboardPollTimer?.cancel();
    _videoCallSocket.dispose();
    _audioCallSocket.dispose();
    _videoConsultationApi.close();
    _api.close();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      unawaited(_refreshDashboardSilently());
    }
  }

  bool _incomingAudioDialogOpen = false;
  String _incomingAudioCallId = '';
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

    _audioSocketUserId = userId;
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
    try {
      final session = await _sessionStore.read();
      return session?.accessToken.trim() ?? '';
    } catch (_) {
      throw const AstrologerPortalApiException(
        'Your session could not be restored. Please retry or login again.',
      );
    }
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

  void _restrictAccess(AstrologerPortalApiException error) {
    ++_dashboardRevision;
    // Preserve the canonical login and unrelated customer access.
    setState(() {
      _dashboard = {};
      _error = 'Partner access needs verification. ${error.message}';
      _loading = false;
    });
  }

  Future<void> _loadDashboard() async {
    final revision = ++_dashboardRevision;
    if (mounted) {
      setState(() {
        _loading = true;
        _error = '';
        _refreshWarning = '';
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

      if (!mounted || revision != _dashboardRevision) {
        return;
      }

      setState(() {
        _dashboard = _data(response);
      });
    } on AstrologerPortalApiException catch (error) {
      if (!mounted || revision != _dashboardRevision) {
        return;
      }

      if (error.accessDenied) {
        _restrictAccess(error);
        return;
      }
      setState(() {
        _error = error.message;
      });
    } catch (_) {
      if (mounted && revision == _dashboardRevision) {
        setState(() => _error = 'Unable to load your dashboard. Please retry.');
      }
    } finally {
      if (mounted && revision == _dashboardRevision) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  Future<void> _refreshDashboardSilently() async {
    if (!mounted ||
        (WidgetsBinding.instance.lifecycleState != null &&
            WidgetsBinding.instance.lifecycleState !=
                AppLifecycleState.resumed) ||
        _dashboardPolling ||
        _statusUpdating ||
        _loading ||
        _isLoggingOut) {
      return;
    }

    final route = ModalRoute.of(context);

    if (route != null && !route.isCurrent) {
      return;
    }

    _dashboardPolling = true;
    final revision = _dashboardRevision;

    try {
      final token = await _accessToken();

      if (token.isEmpty) {
        return;
      }

      final response = await _api.getDashboard(accessToken: token);

      if (!mounted || revision != _dashboardRevision) {
        return;
      }

      setState(() {
        _dashboard = _data(response);
        _refreshWarning = '';
      });
    } on AstrologerPortalApiException catch (error) {
      if (!mounted || revision != _dashboardRevision) return;
      if (error.accessDenied) {
        _restrictAccess(error);
      } else {
        setState(
          () => _refreshWarning = 'Refresh unavailable. Pull down to retry.',
        );
      }
    } catch (_) {
      if (mounted && revision == _dashboardRevision) {
        setState(
          () => _refreshWarning =
              'Refresh unavailable. Showing the last loaded dashboard. Pull down to retry.',
        );
      }
    } finally {
      _dashboardPolling = false;
    }
  }

  Future<void> _setOnline(bool value) async {
    if (_statusUpdating) {
      return;
    }

    final previous = _dashboard['isOnline'] == true;
    ++_dashboardRevision;

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

      if (error.accessDenied) {
        _restrictAccess(error);
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

    try {
      await secureLogout(_sessionStore);
    } catch (_) {
      if (mounted) {
        setState(() {
          _isLoggingOut = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Unable to confirm complete sign-out. Please retry logout.',
            ),
          ),
        );
      }
      return;
    }

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
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_error.isNotEmpty) {
      return Scaffold(
        body: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(_error, textAlign: TextAlign.center),
                  const SizedBox(height: 16),
                  FilledButton(
                    onPressed: _loadDashboard,
                    child: const Text('Retry'),
                  ),
                  TextButton(
                    onPressed: () => Navigator.of(context).pushAndRemoveUntil(
                      MaterialPageRoute<void>(builder: (_) => const AuthGate()),
                      (route) => false,
                    ),
                    child: const Text('Recheck account access'),
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
    final name = _dashboard['name']?.toString().trim() ?? '';
    final avatar = _dashboard['avatarUrl']?.toString().trim() ?? '';
    String value(String key, {bool money = false, String suffix = ''}) {
      final number = num.tryParse(_dashboard[key]?.toString() ?? '');
      if (number == null || !number.isFinite) return 'Unavailable';
      return money ? '\u20B9${number.toStringAsFixed(2)}' : '$number$suffix';
    }

    Widget heading(String title) => Padding(
      padding: const EdgeInsets.only(top: 22, bottom: 12),
      child: Text(
        title,
        style: const TextStyle(
          color: AppColors.navy,
          fontSize: 18,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
    final tools = <PartnerToolCard>[
      PartnerToolCard(
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
      PartnerToolCard(
        icon: Icons.article_outlined,
        title: 'Posts',
        subtitle: 'Write articles and track admin approval',
        onTap: () async {
          await Navigator.of(context).push(
            MaterialPageRoute<void>(
              builder: (_) => const AstrologerArticlesScreen(),
            ),
          );

          if (context.mounted) {
            await _loadDashboard();
          }
        },
      ),
      if (supportOperationsUiEnabled)
        PartnerToolCard(
          icon: Icons.support_agent_rounded,
          title: 'Help & Support',
          subtitle: 'Manage your private support requests',
          onTap: isApproved
              ? () => Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => const SupportHomeScreen(),
                  ),
                )
              : null,
        ),
      PartnerToolCard(
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
      PartnerToolCard(
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
      PartnerToolCard(
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
      PartnerToolCard(
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
      PartnerToolCard(
        icon: Icons.account_balance_wallet_outlined,
        title: 'Earnings',
        subtitle: 'Income, transactions and payments',
        onTap: () async {
          await Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const AstrologerEarningsScreen()),
          );

          if (context.mounted) {
            await _loadDashboard();
          }
        },
      ),
      PartnerToolCard(
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
      PartnerToolCard(
        icon: Icons.auto_awesome_outlined,
        title: 'Kundali',
        subtitle: 'Prepare and manage professional Kundli reports',
        onTap: () async {
          await _openKundliSubscriptionGate(
            unlockedScreen: const AstrologerManualKundliReportsScreen(),
          );
        },
      ),
      PartnerToolCard(
        icon: Icons.description_outlined,
        title: 'Reports',
        subtitle: 'Access generated astrology reports',
        onTap: () async {
          await _openKundliSubscriptionGate(
            unlockedScreen: const AstrologerSavedKundlisScreen(),
          );
        },
      ),
      PartnerToolCard(
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
      PartnerToolCard(
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
    ];
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        automaticallyImplyLeading: false,
        backgroundColor: AppColors.background,
        foregroundColor: AppColors.navy,
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Astro Soul Path',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
            ),
            Text(
              'ASTROLOGER PARTNER',
              style: TextStyle(
                fontSize: 9,
                letterSpacing: 1.5,
                color: AppColors.goldDark,
                fontWeight: FontWeight.w700,
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: _loadDashboard,
            icon: const Icon(Icons.refresh_rounded),
          ),
          const SubscriptionNotificationsBell(
            audience: SubscriptionAudience.astrologer,
          ),
          IconButton(
            tooltip: 'Logout',
            onPressed: _isLoggingOut ? null : _logout,
            icon: const Icon(Icons.logout_rounded),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _loadDashboard,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
          children: [
            if (_refreshWarning.isNotEmpty)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Text(
                  _refreshWarning,
                  semanticsLabel: _refreshWarning,
                  style: const TextStyle(color: AppColors.navy),
                ),
              ),
            PartnerCard(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 25,
                        backgroundColor: AppColors.purpleSoft,
                        backgroundImage: avatar.isEmpty
                            ? null
                            : NetworkImage(avatar),
                        child: avatar.isEmpty
                            ? const Icon(
                                Icons.person_outline_rounded,
                                color: AppColors.purple,
                              )
                            : null,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              name.isEmpty ? 'Astrologer' : name,
                              style: const TextStyle(
                                color: AppColors.navy,
                                fontSize: 19,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              isApproved && isVerified
                                  ? 'Verified Astrologer'
                                  : 'Verification Pending',
                              style: const TextStyle(
                                color: AppColors.muted,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (isApproved && isVerified)
                        const Tooltip(
                          message: 'Approved and verified',
                          child: Icon(
                            Icons.verified_rounded,
                            color: AppColors.purple,
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 12,
                    runSpacing: 8,
                    children: [
                      Text(
                        partnerRatingLabel(_dashboard['rating']),
                        style: const TextStyle(color: AppColors.muted),
                      ),
                      Text(
                        'Experience: ${value('experience', suffix: ' yrs')}',
                        style: const TextStyle(color: AppColors.muted),
                      ),
                    ],
                  ),
                  const Divider(height: 24),
                  Row(
                    children: [
                      Icon(
                        Icons.circle,
                        size: 9,
                        color: isOnline
                            ? Colors.green.shade700
                            : AppColors.muted,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          isOnline
                              ? 'Online - Available'
                              : 'Offline - Unavailable',
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ),
                      if (_statusUpdating)
                        const SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(strokeWidth: 2),
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
            heading('Overview'),
            PartnerGrid(
              children: [
                PartnerMetric(
                  label: 'Total Earnings',
                  value: earningsBuckets(_dashboard['earningsByCurrency']),
                  icon: Icons.account_balance_wallet_outlined,
                ),
                PartnerMetric(
                  label: 'Audio Calls (Today)',
                  value: value('todayCalls'),
                  icon: Icons.call_outlined,
                ),
                PartnerMetric(
                  label: 'Chats (Today)',
                  value: value('todayChats'),
                  icon: Icons.chat_bubble_outline_rounded,
                ),
                PartnerMetric(
                  label: 'Profile Completion',
                  value: value('profileCompletion', suffix: '%'),
                  icon: Icons.person_outline_rounded,
                ),
                PartnerMetric(
                  label: 'Pending Requests',
                  value: value('pendingConsultations'),
                  icon: Icons.schedule_rounded,
                ),
                PartnerMetric(
                  label: 'Price / min',
                  value: value('pricePerMin', money: true),
                  icon: Icons.currency_rupee_rounded,
                ),
              ],
            ),
            heading('Quick Actions'),
            PartnerQuickActions(tools: tools),
            for (final entry in {
              'Languages': _strings(_dashboard['languages']),
              'Expertise': _strings(_dashboard['expertise']),
            }.entries)
              if (entry.value.isNotEmpty) ...[
                heading(entry.key),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    for (final text in entry.value)
                      Chip(
                        backgroundColor: AppColors.purpleSoft,
                        side: BorderSide.none,
                        label: Text(text),
                      ),
                  ],
                ),
              ],
            heading('Partner Tools'),
            PartnerGrid(children: tools),
          ],
        ),
      ),
    );
  }
}
