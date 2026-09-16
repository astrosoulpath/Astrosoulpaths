import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../auth/data/auth_session_store.dart';
import '../../data/review_api.dart';

class RateReviewButton extends StatefulWidget {
  const RateReviewButton({
    required this.callSessionId,
    required this.astrologerName,
    super.key,
  });

  final String callSessionId;
  final String astrologerName;

  @override
  State<RateReviewButton> createState() => _RateReviewButtonState();
}

class _RateReviewButtonState extends State<RateReviewButton> {
  bool _submitted = false;
  bool _submitting = false;

  Future<void> _openReview() async {
    if (_submitted || _submitting || !mounted) {
      return;
    }

    final submission = await showModalBottomSheet<_ReviewSubmission>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: const Color(0xFF08050D),
      builder: (_) {
        return _ReviewSheet(astrologerName: widget.astrologerName);
      },
    );

    // Cancel / swipe-down / back button.
    if (submission == null || !mounted) {
      return;
    }

    setState(() {
      _submitting = true;
    });

    try {
      final session = await AuthSessionStore().read();

      if (!mounted) {
        return;
      }

      final token = session?.accessToken.trim() ?? '';

      if (token.isEmpty) {
        throw const ReviewApiException(
          'Your login session has expired. Please login again.',
        );
      }

      final api = ReviewApi();

      try {
        await api.submitReview(
          accessToken: token,
          callSessionId: widget.callSessionId.trim(),
          rating: submission.rating,
          comment: submission.comment,
        );
      } finally {
        api.close();
      }

      if (!mounted) {
        return;
      }

      setState(() {
        _submitted = true;
      });

      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(
          const SnackBar(
            content: Text('Thank you. Your review was submitted.'),
          ),
        );
    } on ReviewApiException catch (error) {
      if (!mounted) {
        return;
      }

      final message = error.message.trim();

      if (message.toLowerCase().contains('already been reviewed')) {
        setState(() {
          _submitted = true;
        });
      }

      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(
          SnackBar(
            content: Text(
              message.isEmpty ? 'Unable to submit review.' : message,
            ),
          ),
        );
    } catch (_) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(
          const SnackBar(content: Text('Unable to submit review right now.')),
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
    if (_submitted) {
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: AppColors.surfaceLight,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: AppColors.gold.withValues(alpha: 0.3)),
        ),
        child: const Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.check_circle_rounded, color: AppColors.gold, size: 19),
            SizedBox(width: 7),
            Text(
              'Review submitted',
              style: TextStyle(
                color: AppColors.white,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      );
    }

    return SizedBox(
      width: double.infinity,
      child: OutlinedButton.icon(
        // RATE_REVIEW_PREMIUM_GOLD
        style: OutlinedButton.styleFrom(
          foregroundColor: const Color(0xFFFFD84A),
          backgroundColor: const Color(0xFF100B14),
          side: const BorderSide(color: Color(0xFFFFC928), width: 1.15),
          padding: const EdgeInsets.symmetric(vertical: 15),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(18),
          ),
          textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
        ),
        onPressed: _submitting ? null : _openReview,
        icon: _submitting
            ? const SizedBox(
                width: 17,
                height: 17,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: AppColors.gold,
                ),
              )
            : const Icon(Icons.star_outline_rounded),
        label: Text(_submitting ? 'Submitting...' : 'Rate & Review'),
      ),
    );
  }
}

class _ReviewSheet extends StatefulWidget {
  const _ReviewSheet({required this.astrologerName});

  final String astrologerName;

  @override
  State<_ReviewSheet> createState() => _ReviewSheetState();
}

class _ReviewSheetState extends State<_ReviewSheet> {
  final TextEditingController _commentController = TextEditingController();

  int _rating = 5;

  @override
  void dispose() {
    // Controller is disposed only when the bottom sheet itself
    // has actually left the widget tree.
    _commentController.dispose();
    super.dispose();
  }

  void _submit() {
    Navigator.of(context).pop(
      _ReviewSubmission(
        rating: _rating,
        comment: _commentController.text.trim(),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final keyboardInset = MediaQuery.viewInsetsOf(context).bottom;

    return Padding(
      padding: EdgeInsets.fromLTRB(20, 18, 20, 20 + keyboardInset),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const Expanded(
                  child: Text(
                    'Rate Your Consultation',
                    style: TextStyle(
                      color: AppColors.white,
                      fontSize: 21,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
                IconButton(
                  tooltip: 'Close',
                  onPressed: () {
                    Navigator.of(context).pop();
                  },
                  icon: const Icon(Icons.close_rounded, color: AppColors.white),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              widget.astrologerName.trim().isEmpty
                  ? 'Share your consultation experience.'
                  : 'How was your consultation with '
                        '${widget.astrologerName}?',
              style: const TextStyle(color: AppColors.muted, height: 1.4),
            ),
            const SizedBox(height: 22),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(5, (index) {
                final star = index + 1;

                return IconButton(
                  onPressed: () {
                    setState(() {
                      _rating = star;
                    });
                  },
                  iconSize: 38,
                  icon: Icon(
                    star <= _rating
                        ? Icons.star_rounded
                        : Icons.star_border_rounded,
                    color: AppColors.gold,
                  ),
                );
              }),
            ),
            const SizedBox(height: 8),
            Center(
              child: Text(
                '$_rating / 5',
                style: const TextStyle(
                  color: AppColors.gold,
                  fontWeight: FontWeight.w900,
                ),
              ),
            ),
            const SizedBox(height: 20),
            TextField(
              controller: _commentController,
              maxLines: 5,
              maxLength: 1000,
              style: const TextStyle(color: AppColors.white),
              decoration: InputDecoration(
                labelText: 'Write a review (optional)',
                labelStyle: const TextStyle(color: AppColors.muted),
                hintText: 'Tell us about your experience...',
                hintStyle: const TextStyle(color: AppColors.muted),
                filled: true,
                fillColor: AppColors.surface,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: const BorderSide(color: AppColors.border),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: const BorderSide(color: AppColors.gold),
                ),
              ),
            ),
            const SizedBox(height: 14),
            FilledButton.icon(
              onPressed: _submit,
              icon: const Icon(Icons.star_rounded),
              label: const Text('Submit Review'),
            ),
          ],
        ),
      ),
    );
  }
}

class _ReviewSubmission {
  const _ReviewSubmission({required this.rating, required this.comment});

  final int rating;
  final String comment;
}
