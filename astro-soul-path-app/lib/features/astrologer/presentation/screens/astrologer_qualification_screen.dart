import 'package:flutter/material.dart';

import '../../data/astrologer_portal_api.dart';

class AstrologerQualificationScreen extends StatefulWidget {
  const AstrologerQualificationScreen({super.key, required this.accessToken});

  final String accessToken;

  @override
  State<AstrologerQualificationScreen> createState() =>
      _AstrologerQualificationScreenState();
}

class _AstrologerQualificationScreenState
    extends State<AstrologerQualificationScreen> {
  final AstrologerPortalApi _api = AstrologerPortalApi();

  bool _loading = true;
  bool _submitting = false;

  String? _error;

  List<Map<String, dynamic>> _questions = [];
  final Map<String, String> _answers = {};

  @override
  void initState() {
    super.initState();
    _loadQuestions();
  }

  Future<void> _loadQuestions() async {
    if (mounted) {
      setState(() {
        _loading = true;
        _error = null;
        _answers.clear();
      });
    }

    try {
      final statusResponse = await _api.getQualificationStatus(
        accessToken: widget.accessToken,
      );

      final statusData = statusResponse['data'];

      if (statusData is! Map) {
        throw const FormatException('Invalid qualification status received.');
      }

      final status = Map<String, dynamic>.from(statusData);

      final passed = status['passed'] == true;
      final canAttempt = status['canAttempt'] == true;
      final reason = status['reason']?.toString().trim() ?? '';

      if (passed) {
        if (!mounted) {
          return;
        }

        Navigator.of(context).pop(true);
        return;
      }

      if (!canAttempt) {
        throw AstrologerPortalApiException(
          reason.isNotEmpty
              ? reason
              : 'Qualification test cannot be attempted right now.',
        );
      }

      final response = await _api.getQualificationQuestions(
        accessToken: widget.accessToken,
      );

      final data = response['data'];

      List<dynamic> rawQuestions = const [];

      if (data is Map<String, dynamic>) {
        final value = data['questions'];
        if (value is List) {
          rawQuestions = value;
        }
      } else if (data is List) {
        rawQuestions = data;
      }

      final questions = rawQuestions
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList();

      if (questions.isEmpty) {
        throw const FormatException(
          'No qualification questions were returned.',
        );
      }

      if (!mounted) {
        return;
      }

      setState(() {
        _questions = questions;
        _loading = false;
      });
    } on AstrologerPortalApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _loading = false;
        _error = error.message;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _loading = false;
        _error = error.toString();
      });
    }
  }

  Future<void> _submit() async {
    if (_submitting) {
      return;
    }

    if (_answers.length != _questions.length) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Please answer all ${_questions.length} questions before submitting.',
          ),
        ),
      );
      return;
    }

    setState(() {
      _submitting = true;
    });

    try {
      final answers = _questions.map((question) {
        final questionId = question['id']?.toString() ?? '';

        return <String, String>{
          'questionId': questionId,
          'selectedOption': _answers[questionId]!,
        };
      }).toList();

      final response = await _api.submitQualification(
        accessToken: widget.accessToken,
        answers: answers,
      );

      final data = response['data'];

      if (data is! Map) {
        throw const FormatException('Invalid qualification result received.');
      }

      final result = Map<String, dynamic>.from(data);

      final passed = result['passed'] == true;
      final score = result['score'];
      final passingPercentage = result['passingPercentage'];

      if (!mounted) {
        return;
      }

      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (dialogContext) {
          return AlertDialog(
            icon: Icon(
              passed ? Icons.verified_rounded : Icons.info_outline_rounded,
              size: 52,
              color: passed ? Colors.green : Colors.orange,
            ),
            title: Text(
              passed ? 'Qualification Passed' : 'Qualification Not Passed',
            ),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  passed
                      ? 'Congratulations! You have successfully passed the astrologer knowledge test.'
                      : 'You did not reach the required passing score.',
                  textAlign: TextAlign.center,
                ),
                if (score != null) ...[
                  const SizedBox(height: 16),
                  Text(
                    'Your Score: $score%',
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 17,
                    ),
                  ),
                ],
                if (passingPercentage != null) ...[
                  const SizedBox(height: 5),
                  Text('Passing Score: $passingPercentage%'),
                ],
                const SizedBox(height: 12),
                Text(
                  passed
                      ? 'You can now continue your astrologer registration.'
                      : 'Retake availability is controlled by the administrator.',
                  textAlign: TextAlign.center,
                ),
              ],
            ),
            actions: [
              FilledButton(
                onPressed: () {
                  Navigator.of(dialogContext).pop();
                },
                child: Text(passed ? 'Continue' : 'OK'),
              ),
            ],
          );
        },
      );

      if (!mounted) {
        return;
      }

      if (passed) {
        Navigator.of(context).pop(true);
      } else {
        await _loadQuestions();
      }
    } on AstrologerPortalApiException catch (error) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.message),
          backgroundColor: Colors.red.shade700,
        ),
      );
    } catch (error) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString()),
          backgroundColor: Colors.red.shade700,
        ),
      );
    } finally {
      if (mounted) {
        setState(() {
          _submitting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF4F6FA),
      appBar: AppBar(
        title: const Text('Astrologer Qualification'),
        backgroundColor: const Color(0xFF071936),
        foregroundColor: Colors.white,
      ),
      body: _buildBody(),
    );
  }

  Widget _buildBody() {
    if (_loading) {
      return const Center(child: CircularProgressIndicator());
    }

    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.error_outline_rounded,
                size: 54,
                color: Colors.red,
              ),
              const SizedBox(height: 16),
              Text(_error!, textAlign: TextAlign.center),
              const SizedBox(height: 20),
              FilledButton.icon(
                onPressed: _loadQuestions,
                icon: const Icon(Icons.refresh),
                label: const Text('Try Again'),
              ),
            ],
          ),
        ),
      );
    }

    final answered = _answers.length;
    final total = _questions.length;
    final progress = total == 0 ? 0.0 : answered / total;

    return SafeArea(
      child: Column(
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.fromLTRB(20, 18, 20, 18),
            color: Colors.white,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Knowledge Assessment',
                  style: TextStyle(
                    fontSize: 21,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF071936),
                  ),
                ),
                const SizedBox(height: 6),
                const Text(
                  'Answer every question. Your result will be evaluated automatically.',
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: LinearProgressIndicator(
                        value: progress,
                        minHeight: 8,
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Text(
                      '$answered/$total',
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: _questions.length,
              separatorBuilder: (_, _) => const SizedBox(height: 14),
              itemBuilder: (context, index) {
                return _buildQuestionCard(index, _questions[index]);
              },
            ),
          ),
          Container(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
            decoration: const BoxDecoration(
              color: Colors.white,
              boxShadow: [
                BoxShadow(
                  blurRadius: 10,
                  color: Color(0x14000000),
                  offset: Offset(0, -2),
                ),
              ],
            ),
            child: SizedBox(
              width: double.infinity,
              height: 52,
              child: FilledButton.icon(
                onPressed: _submitting ? null : _submit,
                icon: _submitting
                    ? const SizedBox(
                        width: 19,
                        height: 19,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.task_alt_rounded),
                label: Text(
                  _submitting ? 'Submitting...' : 'Submit Qualification Test',
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuestionCard(int index, Map<String, dynamic> question) {
    final id = question['id']?.toString() ?? '';

    final options = <String, String>{
      'A': question['optionA']?.toString() ?? '',
      'B': question['optionB']?.toString() ?? '',
      'C': question['optionC']?.toString() ?? '',
      'D': question['optionD']?.toString() ?? '',
    };

    return Card(
      elevation: 0,
      color: Colors.white,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: Color(0xFFE4E8F0)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(17),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Question ${index + 1}',
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: Color(0xFF687386),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              question['question']?.toString() ?? '',
              style: const TextStyle(
                fontSize: 17,
                height: 1.4,
                fontWeight: FontWeight.w700,
                color: Color(0xFF101828),
              ),
            ),
            const SizedBox(height: 13),
            RadioGroup<String>(
              groupValue: _answers[id],
              onChanged: _submitting
                  ? (_) {}
                  : (value) {
                      if (value == null) {
                        return;
                      }

                      setState(() {
                        _answers[id] = value;
                      });
                    },
              child: Column(
                children: options.entries.map((option) {
                  return RadioListTile<String>(
                    contentPadding: EdgeInsets.zero,
                    value: option.key,
                    title: Text(
                      '${option.key}. ${option.value}',
                      style: const TextStyle(
                        color: Color(0xFF1F2937),
                        fontSize: 15.5,
                        fontWeight: FontWeight.w600,
                        height: 1.35,
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
