import 'package:flutter/material.dart';

import '../../../../core/theme/app_theme.dart';
import '../../data/marketplace_seller_api.dart';

class MarketplaceSellerProfileScreen extends StatefulWidget {
  const MarketplaceSellerProfileScreen({super.key, this.initialProfile});

  final Map<String, dynamic>? initialProfile;

  @override
  State<MarketplaceSellerProfileScreen> createState() =>
      _MarketplaceSellerProfileScreenState();
}

class _MarketplaceSellerProfileScreenState
    extends State<MarketplaceSellerProfileScreen> {
  final GlobalKey<FormState> _formKey = GlobalKey<FormState>();
  final MarketplaceSellerApi _api = MarketplaceSellerApi();

  late final TextEditingController _shopNameController;
  late final TextEditingController _shopBioController;

  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();

    _shopNameController = TextEditingController(
      text: widget.initialProfile?['shopDisplayName']?.toString() ?? '',
    );

    _shopBioController = TextEditingController(
      text: widget.initialProfile?['shopBio']?.toString() ?? '',
    );
  }

  @override
  void dispose() {
    _api.dispose();
    _shopNameController.dispose();
    _shopBioController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      final savedProfile = await _api.saveProfile(
        shopDisplayName: _shopNameController.text.trim(),
        shopBio: _shopBioController.text.trim(),
      );

      if (!mounted) {
        return;
      }

      Navigator.of(context).pop(savedProfile);
    } on MarketplaceSellerApiException catch (error) {
      if (!mounted) {
        return;
      }

      setState(() {
        _saving = false;
        _error = error.message;
      });
    } catch (_) {
      if (!mounted) {
        return;
      }

      setState(() {
        _saving = false;
        _error = 'Unable to save seller profile.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF090909),
      appBar: AppBar(
        backgroundColor: const Color(0xFF090909),
        foregroundColor: AppColors.white,
        title: const Text(
          'Seller Profile',
          style: TextStyle(fontWeight: FontWeight.w800),
        ),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(18),
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFF151515),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(
                  color: AppColors.gold.withValues(alpha: 0.24),
                ),
              ),
              child: const Text(
                'Your shop profile is reviewed and controlled through the marketplace approval flow.',
                style: TextStyle(color: AppColors.white, height: 1.45),
              ),
            ),
            const SizedBox(height: 18),
            TextFormField(
              controller: _shopNameController,
              maxLength: 120,
              style: const TextStyle(color: AppColors.white),
              decoration: const InputDecoration(
                labelText: 'Shop display name',
                hintText: 'Enter your shop name',
              ),
            ),
            const SizedBox(height: 10),
            TextFormField(
              controller: _shopBioController,
              maxLength: 1000,
              maxLines: 6,
              style: const TextStyle(color: AppColors.white),
              decoration: const InputDecoration(
                labelText: 'Shop bio',
                hintText: 'Describe your shop and products',
                alignLabelWithHint: true,
              ),
            ),
            if (_error != null) ...[
              const SizedBox(height: 14),
              Text(
                _error!,
                style: const TextStyle(
                  color: Colors.redAccent,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
            const SizedBox(height: 22),
            FilledButton.icon(
              onPressed: _saving ? null : _save,
              icon: _saving
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.save_outlined),
              label: Text(_saving ? 'Saving...' : 'Save seller profile'),
            ),
          ],
        ),
      ),
    );
  }
}
