import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:astro_soul_path/features/chat/data/voice_recording_startup.dart';

void main() {
  for (final stage in ['permission', 'initialization', 'native start']) {
    test(
      'cancellation during $stage fences startup and cancels native recorder',
      () async {
        final gate = VoiceRecordingStartup();
        final pending = Completer<void>();
        var active = false, cancellations = 0;
        final work = gate.run(
          (current) async {
            await pending.future;
            if (current()) active = true;
          },
          cancelRecorder: () async {
            cancellations++;
          },
        );
        gate.cancel();
        pending.complete();
        await work;
        expect(active, false);
        expect(cancellations, 1);
        expect(gate.starting, false);
      },
    );
  }
  test(
    'screen disposal waits for pending startup cancellation before native disposal',
    () async {
      final gate = VoiceRecordingStartup();
      final pending = Completer<void>();
      final order = <String>[];
      final work = gate.run(
        (current) async {
          await pending.future;
          expect(current(), false);
        },
        cancelRecorder: () async {
          order.add('cancel');
        },
      );
      final closed = gate.close(() async {
        order.add('dispose');
      });
      expect(order, isEmpty);
      pending.complete();
      await work;
      await closed;
      expect(order, ['cancel', 'dispose']);
      await gate.run((_) async {
        fail('closed gate started');
      }, cancelRecorder: () async {});
    },
  );
  test(
    'duplicate starts are serialized and recording can repeat after cancellation',
    () async {
      final gate = VoiceRecordingStartup();
      final pending = Completer<void>();
      var starts = 0;
      final work = gate.run((_) async {
        starts++;
        await pending.future;
      }, cancelRecorder: () async {});
      await gate.run((_) async {
        starts++;
      }, cancelRecorder: () async {});
      gate.cancel();
      pending.complete();
      await work;
      await gate.run((current) async {
        expect(current(), true);
        starts++;
      }, cancelRecorder: () async {});
      expect(starts, 2);
    },
  );
  test(
    'initialization errors release the gate for another recording',
    () async {
      final gate = VoiceRecordingStartup();
      await expectLater(
        gate.run((_) async {
          throw StateError('fixture');
        }, cancelRecorder: () async {}),
        throwsStateError,
      );
      expect(gate.starting, false);
      await gate.run((current) async {
        expect(current(), true);
      }, cancelRecorder: () async {});
    },
  );
}
