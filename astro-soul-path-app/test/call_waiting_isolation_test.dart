import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:astro_soul_path/features/calling/data/call_signal_scope.dart';
import 'package:astro_soul_path/features/customer/data/customer_consultation_api.dart';
import 'package:astro_soul_path/features/auth/data/auth_session_store.dart';

class MemorySession extends AuthSessionStore {
  @override
  Future<StoredAuthSession?> read() async => StoredAuthSession(
    accessToken: 'mock',
    refreshToken: '',
    role: 'CUSTOMER',
    portal: 'customer',
    nextStep: 'DASHBOARD',
    user: {'id': 'customer'},
    expiresIn: 3600,
    authProvider: 'firebase',
  );
}

void main() {
  for (final key in ['callId', 'callSessionId', 'consultationId']) {
    test('accepts matching $key and rejects foreign or missing identity', () {
      expect(matchesCallSignal({key: 'request'}, 'request'), true);
      expect(matchesCallSignal({key: 'foreign'}, 'request'), false);
      expect(matchesCallSignal({}, 'request'), false);
      expect(matchesCallSignal(null, 'request'), false);
    });
  }
  test(
    'rejects contradictory IDs rather than applying a foreign request event',
    () {
      expect(
        matchesCallSignal({
          'callId': 'request',
          'consultationId': 'foreign',
        }, 'request'),
        false,
      );
    },
  );
  test(
    'request-specific status uses the existing authenticated API and preserves terminal state',
    () async {
      final api = CustomerConsultationApi(
        sessionStore: MemorySession(),
        client: MockClient((request) async {
          expect(request.method, 'GET');
          expect(request.url.path, '/consultations/request');
          expect(request.headers['Authorization'], 'Bearer mock');
          return http.Response(
            jsonEncode({
              'success': true,
              'data': {'id': 'request', 'status': 'REJECTED'},
            }),
            200,
          );
        }),
      );
      expect((await api.getById('request'))['data']['status'], 'REJECTED');
      api.close();
    },
  );
  test(
    'waiting screen keeps missed/rejected signals advisory and prevents terminal reconnect ringing',
    () {
      final source = File(
        'lib/features/consultations/presentation/screens/customer_consultation_waiting_screen.dart',
      ).readAsStringSync();
      for (final segment in source.split('onMissed:').skip(1)) {
        final handler = segment.split('onUnavailable:').first;
        expect(handler, contains('_checkStatus()'));
        expect(handler, isNot(contains("_status = 'EXPIRED'")));
        expect(handler, isNot(contains('_stopPolling()')));
      }
      expect(source, contains('_api.getById(widget.consultationId)'));
      expect(source, contains("_status != 'PENDING'"));
      expect(source, contains('_chatOpened || _cancelling'));
      final cancel = source.substring(
        source.indexOf('  Future<void> _cancelRequest()'),
      );
      expect(
        cancel.indexOf('_api.cancel('),
        lessThan(cancel.indexOf('_audioCallSocket.cancel(')),
      );
      expect(
        cancel.indexOf('_api.cancel('),
        lessThan(cancel.indexOf('_videoCallSocket.cancel(')),
      );
    },
  );
}
