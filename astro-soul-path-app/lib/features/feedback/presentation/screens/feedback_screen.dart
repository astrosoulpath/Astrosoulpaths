import '../../../support/presentation/widgets/support_account_boundary.dart';
import 'package:flutter/material.dart';

import '../../data/feedback_api.dart';

class FeedbackScreen extends StatefulWidget {
  const FeedbackScreen({super.key, this.consultationId, this.api});
  final String? consultationId;
  final FeedbackApi? api;

  @override
  State<FeedbackScreen> createState() => _FeedbackScreenState();
}

class _FeedbackScreenState extends State<FeedbackScreen> {
  final _formKey = GlobalKey<FormState>();
  final _messageController = TextEditingController();
  late final _api = widget.api ?? FeedbackApi();

  bool _submitting = false;
  bool _loadingHistory = true;

  int _rating = 0;
  String _category = 'GENERAL';

  String? _error;
  String? _historyError;
  List<Map<String, dynamic>> _history = [];
  int _page = 1, _loadVersion = 0;
  bool _hasMore = true;

  static const _categories = <String, String>{
    'GENERAL': 'General',
    'APP_EXPERIENCE': 'App Experience',
    'ASTROLOGY_CONTENT': 'Astrology Content',
    'PAYMENT': 'Payment',
    'CONSULTATION': 'Consultation',
    'TECHNICAL': 'Technical',
    'SUGGESTION': 'Suggestion',
    'OTHER': 'Other',
  };

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  @override
  void dispose() {
    _api.close();
    _messageController.dispose();
    super.dispose();
  }

  Future<void> _loadHistory() async {
    final version = ++_loadVersion;
    final page = _page;
    setState(() {
      _loadingHistory = true;
      _historyError = null;
    });
    try {
      final items = await _api.getMine(page: _page);

      if (!mounted || version != _loadVersion) return;

      setState(() {
        _hasMore = items.length == 25;
        _history = _page == 1
            ? items
            : {
                for (final item in [..._history, ...items]) item['id']: item,
              }.values.toList();
        _loadingHistory = false;
        _historyError = null;
      });
    } on FeedbackApiException catch (error) {
      if (!mounted || version != _loadVersion) return;

      setState(() {
        _historyError = error.message;
        _loadingHistory = false;
        if (page > 1) _page = page - 1;
      });
    } catch (_) {
      if (!mounted || version != _loadVersion) return;

      setState(() {
        _historyError = 'Unable to load feedback history.';
        _loadingHistory = false;
        if (page > 1) _page = page - 1;
      });
    }
  }

  Future<void> _submit() async {
    if (_submitting) return;

    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      await _api.submit(
        category: _category,
        rating: _rating == 0 ? null : _rating,
        message: _messageController.text,
        consultationId: widget.consultationId,
      );

      if (!mounted) return;

      _messageController.clear();

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Thank you. Your feedback has been submitted.'),
        ),
      );

      _page = 1;
      await _loadHistory();
    } on FeedbackApiException catch (error) {
      if (!mounted) return;

      setState(() {
        _error = error.message;
      });
    } catch (_) {
      if (!mounted) return;

      setState(() {
        _error = 'Unable to submit feedback right now.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _submitting = false;
        });
      }
    }
  }

  String _statusLabel(String value) {
    switch (value) {
      case 'REVIEWED':
        return 'Reviewed';
      case 'RESOLVED':
        return 'Resolved';
      default:
        return 'New';
    }
  }

  String _categoryLabel(String value) {
    return _categories[value] ?? value;
  }

  @override
  Widget build(BuildContext context) =>
      SupportAccountBoundary(child: _buildContent(context));

  Widget _buildContent(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: Theme.of(context).scaffoldBackgroundColor,
        title: const Text('Feedback'),
        actions: [
          if (_hasMore && _history.isNotEmpty)
            IconButton(
              tooltip: 'Load more feedback',
              onPressed: _loadingHistory
                  ? null
                  : () {
                      if (_loadingHistory) return;
                      _page++;
                      _loadHistory();
                    },
              icon: const Icon(Icons.expand_more),
            ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _loadHistory,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(18, 18, 18, 30),
            children: [
              Text(
                'Help us improve Astro Soul Path',
                style: theme.textTheme.headlineSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Share your experience with our team. Your feedback is reviewed by the admin team.',
                style: theme.textTheme.bodyMedium?.copyWith(height: 1.5),
              ),
              const SizedBox(height: 24),

              Form(
                key: _formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Category',
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 8),

                    DropdownButtonFormField<String>(
                      isExpanded: true,
                      itemHeight: null,
                      initialValue: _category,
                      decoration: const InputDecoration(
                        border: OutlineInputBorder(),
                      ),
                      items: _categories.entries
                          .map(
                            (entry) => DropdownMenuItem<String>(
                              value: entry.key,
                              child: Text(entry.value),
                            ),
                          )
                          .toList(),
                      onChanged: _submitting
                          ? null
                          : (value) {
                              if (value == null) return;

                              setState(() {
                                _category = value;
                              });
                            },
                    ),

                    const SizedBox(height: 22),

                    Text(
                      'Your rating (optional)',
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 8),

                    Row(
                      children: List.generate(5, (index) {
                        final value = index + 1;

                        return IconButton(
                          onPressed: _submitting
                              ? null
                              : () {
                                  setState(() {
                                    _rating = _rating == value ? 0 : value;
                                  });
                                },
                          icon: Icon(
                            value <= _rating
                                ? Icons.star_rounded
                                : Icons.star_border_rounded,
                            size: 34,
                            color: value <= _rating
                                ? theme.colorScheme.secondary
                                : theme.colorScheme.onSurfaceVariant,
                          ),
                          tooltip: '$value star',
                        );
                      }),
                    ),

                    const SizedBox(height: 20),

                    Text(
                      'Your feedback',
                      style: theme.textTheme.titleMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 8),

                    TextFormField(
                      controller: _messageController,
                      enabled: !_submitting,
                      maxLength: 2000,
                      minLines: 4,
                      maxLines: 7,
                      decoration: const InputDecoration(
                        hintText: 'Tell us about your experience...',
                        border: OutlineInputBorder(),
                        alignLabelWithHint: true,
                      ),
                      validator: (value) {
                        final message = value?.trim() ?? '';

                        if (message.length < 3) {
                          return 'Please enter at least 3 characters.';
                        }

                        return null;
                      },
                    ),

                    if (_error != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        _error!,
                        style: theme.textTheme.bodyMedium?.copyWith(
                          color: theme.colorScheme.error,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],

                    const SizedBox(height: 12),

                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        onPressed: _submitting ? null : _submit,
                        icon: _submitting
                            ? const SizedBox.square(
                                dimension: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.send_rounded),
                        label: Text(
                          _submitting ? 'Submitting...' : 'Submit Feedback',
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 32),
              const Divider(),
              const SizedBox(height: 18),

              Text(
                'My Feedback',
                style: theme.textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 14),

              if (_loadingHistory)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.all(24),
                    child: CircularProgressIndicator(),
                  ),
                )
              else if (_historyError != null)
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      children: [
                        Text(_historyError!),
                        TextButton(
                          onPressed: _loadHistory,
                          child: const Text('Try again'),
                        ),
                      ],
                    ),
                  ),
                )
              else if (_history.isEmpty)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 20),
                  child: Text('No feedback submitted yet.'),
                )
              else
                ..._history.map((item) {
                  final rating = item['rating'] is num
                      ? (item['rating'] as num).toInt()
                      : 0;

                  final category = item['category']?.toString() ?? 'GENERAL';

                  final status = item['status']?.toString() ?? 'NEW';

                  final message = item['message']?.toString() ?? '';

                  return Card(
                    margin: const EdgeInsets.only(bottom: 12),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  _categoryLabel(category),
                                  style: theme.textTheme.titleMedium?.copyWith(
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                              Chip(label: Text(_statusLabel(status))),
                            ],
                          ),
                          const SizedBox(height: 6),

                          if (rating > 0)
                            Row(
                              children: List.generate(
                                rating,
                                (_) => const Icon(Icons.star_rounded, size: 18),
                              ),
                            ),

                          const SizedBox(height: 10),

                          if (message.trim().isNotEmpty) ...[
                            Text(
                              'Feedback',
                              style: theme.textTheme.labelMedium?.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 5),
                            Text(
                              message,
                              maxLines: 4,
                              overflow: TextOverflow.ellipsis,
                              style: theme.textTheme.bodyMedium?.copyWith(
                                height: 1.45,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  );
                }),
            ],
          ),
        ),
      ),
    );
  }
}
