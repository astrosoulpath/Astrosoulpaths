import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/core/notifications/notification_display_fence.dart';
import 'package:astro_soul_path/core/notifications/notification_session_fence.dart';

void main() {
  setUp(NotificationSessionFence.activate);
  tearDown(NotificationSessionFence.suspend);
  test('current owner displays once', () async {
    var shown = 0;
    expect(
      await NotificationDisplayFence().display(
        authorize: () async => true,
        show: () async {
          shown++;
        },
        clearStale: () async {
          fail('unexpected cleanup');
        },
      ),
      isTrue,
    );
    expect(shown, 1);
  });
  test(
    'account switch while authorization awaits suppresses display',
    () async {
      final authorization = Completer<bool>();
      final pending = NotificationDisplayFence().display(
        authorize: () => authorization.future,
        show: () async {
          fail('stale display');
        },
        clearStale: () async {},
      );
      NotificationSessionFence.activate();
      authorization.complete(true);
      expect(await pending, isFalse);
    },
  );
  test('logout while native show awaits clears stale notification', () async {
    final displayed = Completer<void>();
    var cleared = 0;
    final pending = NotificationDisplayFence().display(
      authorize: () async => true,
      show: () => displayed.future,
      clearStale: () async {
        cleared++;
      },
    );
    await Future<void>.delayed(Duration.zero);
    NotificationSessionFence.suspend();
    displayed.complete();
    expect(await pending, isFalse);
    expect(cleared, 1);
  });
  test('suspended session never authorizes or displays', () async {
    NotificationSessionFence.suspend();
    expect(
      await NotificationDisplayFence().display(
        authorize: () async {
          fail('authorization');
        },
        show: () async {
          fail('show');
        },
        clearStale: () async {},
      ),
      isFalse,
    );
  });
  test('denied ownership never displays', () async {
    expect(
      await NotificationDisplayFence().display(
        authorize: () async => false,
        show: () async {
          fail('show');
        },
        clearStale: () async {},
      ),
      isFalse,
    );
  });
  test('native display failure is not retried', () async {
    var attempts = 0;
    await expectLater(
      NotificationDisplayFence().display(
        authorize: () async => true,
        show: () async {
          attempts++;
          throw StateError('synthetic');
        },
        clearStale: () async {},
      ),
      throwsStateError,
    );
    expect(attempts, 1);
  });
}
