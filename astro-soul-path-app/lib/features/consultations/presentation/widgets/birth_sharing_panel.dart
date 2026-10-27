import 'dart:async';
import 'package:flutter/material.dart';
import '../../data/birth_sharing_api.dart';
import '../../../customer/presentation/screens/customer_profile_screen.dart';

class BirthSharingPanel extends StatefulWidget {
  const BirthSharingPanel({super.key, required this.consultationId, this.api});
  final String consultationId;
  final BirthSharingApi? api;
  @override
  State<BirthSharingPanel> createState() => _BirthSharingPanelState();
}

class _BirthSharingPanelState extends State<BirthSharingPanel>
    with WidgetsBindingObserver {
  late final BirthSharingApi api = widget.api ?? BirthSharingApi();
  Map<String, dynamic>? data;
  Timer? timer;
  Timer? expiryTimer;
  Timer? ownerTimer;
  bool checkingOwner = false;
  int generation = 0;
  bool busy = false;
  String? error;
  String? selectedProfile;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    unawaited(load());
    timer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (WidgetsBinding.instance.lifecycleState == AppLifecycleState.resumed) {
        unawaited(load());
      }
    });
    expiryTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      final expires = DateTime.tryParse(data?['expiresAt']?.toString() ?? '');
      if (expires != null && !expires.isAfter(DateTime.now()) && mounted) {
        generation++;
        setState(() {
          data = null;
          busy = false;
          error = 'Sharing permission expired.';
        });
      }
    });
    ownerTimer = Timer.periodic(const Duration(seconds: 5), (_) async {
      if (checkingOwner || data == null) return;
      checkingOwner = true;
      try {
        if (!await api.hasSameOwner() && mounted) {
          generation++;
          setState(() {
            data = null;
            busy = false;
            error = 'Session changed. Reopen the consultation.';
          });
        }
      } catch (_) {
        if (mounted) {
          generation++;
          setState(() {
            data = null;
            busy = false;
          });
        }
      } finally {
        checkingOwner = false;
      }
    });
  }

  @override
  void didUpdateWidget(BirthSharingPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.consultationId != widget.consultationId) {
      generation++;
      data = null;
      selectedProfile = null;
      busy = false;
      unawaited(load());
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    generation++;
    if (mounted) {
      setState(() {
        data = null;
        busy = false;
      });
    }
    if (state == AppLifecycleState.resumed) unawaited(load());
  }

  Future<void> load({String action = ''}) async {
    if (busy) return;
    final previous = data;
    final epoch = ++generation;
    setState(() {
      busy = true;
      data = null;
      error = null;
    });
    try {
      final result = await api.request(
        widget.consultationId,
        action: action,
        body: action == 'grant'
            ? {
                'policyVersion': previous?['policyVersion'],
                'birthVersion': previous?['birthVersion'],
                'profileRef': previous?['profileRef'],
                'revision': previous?['revision'],
              }
            : action.isEmpty && selectedProfile != null
            ? {'profileRef': selectedProfile}
            : null,
      );
      if (mounted && epoch == generation) setState(() => data = result);
    } catch (_) {
      if (mounted && epoch == generation) {
        setState(
          () => error =
              'Birth details unavailable. Refresh to verify permission.',
        );
      }
    } finally {
      if (mounted && epoch == generation) setState(() => busy = false);
    }
  }

  @override
  void dispose() {
    generation++;
    timer?.cancel();
    expiryTimer?.cancel();
    ownerTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    api.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    String display(String key, Object value) {
      final text = value.toString();
      if (key == 'dateOfBirth') {
        final date = DateTime.tryParse(text);
        if (date != null) {
          return MaterialLocalizations.of(context).formatMediumDate(date);
        }
      }
      if (key == 'timeOfBirth') {
        final parts = text.split(':');
        final hour = int.tryParse(parts.first);
        final minute = parts.length > 1 ? int.tryParse(parts[1]) : null;
        if (hour != null && minute != null && hour < 24 && minute < 60) {
          return MaterialLocalizations.of(context).formatTimeOfDay(
            TimeOfDay(hour: hour, minute: minute),
            alwaysUse24HourFormat: MediaQuery.alwaysUse24HourFormatOf(context),
          );
        }
      }
      return text;
    }

    final details = data?['details'];
    final customer = data?['isCustomer'] == true;
    return Card(
      color: const Color(0xFFFFFBF2),
      child: ExpansionTile(
        initiallyExpanded: true,
        title: const Text(
          'Customer birth details',
          style: TextStyle(color: Color(0xFF172842)),
        ),
        leading: const Icon(Icons.privacy_tip_outlined),
        childrenPadding: const EdgeInsets.all(12),
        children: [
          if (busy) const LinearProgressIndicator(),
          if (error != null) Text(error!),
          if (customer && data?['profiles'] is List)
            DropdownButtonFormField<String>(
              initialValue: selectedProfile,
              isExpanded: true,
              decoration: const InputDecoration(
                labelText: 'Select the birth profile to share',
              ),
              items: [
                for (final profile in data!['profiles'] as List)
                  DropdownMenuItem<String>(
                    value: profile['profileRef'] as String,
                    child: Text(
                      '${profile['label']}',
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
              ],
              onChanged: busy
                  ? null
                  : (value) {
                      selectedProfile = value;
                      unawaited(load());
                    },
            ),
          if (data?['state'] == 'PROFILE_SELECTION_REQUIRED')
            const Text(
              'Choose and review a profile. No details have been shared.',
            ),
          if (data?['state'] == 'NOT_SHARED')
            const Text('Not shared. Customer permission is required.'),
          if (data?['state'] == 'REVOKED') const Text('Permission revoked.'),
          if (data?['state'] == 'MISSING_DETAILS')
            const Text(
              'Birth details are incomplete. Ordinary chat and calls remain available.',
            ),
          if (details is Map) ...[
            for (final field in const {
              'fullName': 'Name',
              'dateOfBirth': 'Date of birth',
              'timeOfBirth': 'Birth time',
              'birthPlace': 'Birth place',
              'gender': 'Gender',
            }.entries)
              if (details[field.key] != null)
                ListTile(
                  dense: true,
                  title: Text(field.value),
                  subtitle: Text(
                    display(field.key, details[field.key] as Object),
                  ),
                ),
          ],
          if (customer) ...[
            Text(
              'Confirm you are authorized to share this selected person\'s details with ${data?['astrologerName'] ?? 'the assigned astrologer'} only for this active consultation. You may revoke permission at any time. Access expires when the consultation ends. This does not authorize Kundli generation.',
            ),
            TextButton(
              onPressed: busy
                  ? null
                  : () async {
                      await Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => const CustomerProfileScreen(),
                        ),
                      );
                      if (mounted) unawaited(load());
                    },
              child: const Text('Review or update my primary profile'),
            ),
            if (details is Map && data?['state'] != 'SHARED')
              FilledButton(
                onPressed: busy ? null : () => load(action: 'grant'),
                child: const Text('I agree — share these details'),
              ),
            if (data?['state'] != 'SHARED')
              TextButton(
                onPressed: busy
                    ? null
                    : () {
                        generation++;
                        setState(() {
                          data = null;
                          selectedProfile = null;
                          error =
                              'Not shared. You can continue your consultation.';
                        });
                      },
                child: const Text('Not now'),
              ),
            if (data?['state'] == 'SHARED' || data?['canRevoke'] == true)
              TextButton(
                onPressed: busy ? null : () => load(action: 'revoke'),
                child: const Text('Revoke sharing'),
              ),
          ],
          TextButton(
            onPressed: busy ? null : () => load(),
            child: const Text('Refresh permission'),
          ),
        ],
      ),
    );
  }
}

class BirthSharingButton extends StatelessWidget {
  const BirthSharingButton({super.key, required this.consultationId});
  final String consultationId;
  @override
  Widget build(BuildContext context) => IconButton(
    tooltip: 'Customer birth details',
    icon: const Icon(Icons.badge_outlined),
    onPressed: () => showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => SafeArea(
        child: SizedBox(
          height: MediaQuery.sizeOf(context).height * .7,
          child: SingleChildScrollView(
            child: BirthSharingPanel(consultationId: consultationId),
          ),
        ),
      ),
    ),
  );
}
