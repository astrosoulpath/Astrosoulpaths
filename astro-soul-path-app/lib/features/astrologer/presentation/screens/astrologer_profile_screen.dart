import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../../../core/theme/app_theme.dart';
import '../../../auth/data/auth_session_store.dart';
import '../../data/astrologer_portal_api.dart';

class AstrologerProfileScreen extends StatefulWidget {
  const AstrologerProfileScreen({super.key});

  @override
  State<AstrologerProfileScreen> createState() =>
      _AstrologerProfileScreenState();
}

class _AstrologerProfileScreenState extends State<AstrologerProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  final _api = AstrologerPortalApi();
  final _sessionStore = AuthSessionStore();

  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _locationController = TextEditingController();
  final _bioController = TextEditingController();
  final _languagesController = TextEditingController();
  final _expertiseController = TextEditingController();
  final _experienceController = TextEditingController();
  final _priceController = TextEditingController();

  bool _loading = true;
  bool _saving = false;
  bool _uploadingAvatar = false;
  String _avatarUrl = '';
  String _error = '';

  bool _isApproved = false;
  bool _isVerified = false;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _locationController.dispose();
    _bioController.dispose();
    _languagesController.dispose();
    _expertiseController.dispose();
    _experienceController.dispose();
    _priceController.dispose();
    _api.close();
    super.dispose();
  }

  Future<String> _token() async {
    final session = await _sessionStore.read();
    return session?.accessToken.trim() ?? '';
  }

  Map<String, dynamic> _data(Map<String, dynamic> response) {
    final data = response['data'];

    if (data is Map<String, dynamic>) {
      return data;
    }

    if (data is Map) {
      return Map<String, dynamic>.from(data);
    }

    return response;
  }

  List<String> _stringList(dynamic value) {
    if (value is! List) {
      return const [];
    }

    return value
        .map((item) => item.toString().trim())
        .where((item) => item.isNotEmpty)
        .toList();
  }

  List<String> _csv(String source) {
    return source
        .split(',')
        .map((item) => item.trim())
        .where((item) => item.isNotEmpty)
        .toSet()
        .toList();
  }

  Future<void> _loadProfile() async {
    setState(() {
      _loading = true;
      _error = '';
    });

    try {
      final accessToken = await _token();

      if (accessToken.isEmpty) {
        throw const AstrologerPortalApiException(
          'Your login session has expired. Please login again.',
        );
      }

      final response = await _api.getProfile(accessToken: accessToken);

      final profile = _data(response);

      if (!mounted) {
        return;
      }

      _nameController.text =
          profile['fullName']?.toString() ?? profile['name']?.toString() ?? '';

      _emailController.text = profile['email']?.toString() ?? '';

      _locationController.text = profile['location']?.toString() ?? '';

      _bioController.text = profile['bio']?.toString() ?? '';

      _languagesController.text = _stringList(profile['languages']).join(', ');

      _expertiseController.text = _stringList(profile['expertise']).join(', ');

      _experienceController.text = (profile['experience'] ?? 0).toString();

      final price =
          double.tryParse(profile['pricePerMin']?.toString() ?? '') ?? 0;

      _priceController.text = price == 0 ? '' : price.toStringAsFixed(0);

      setState(() {
        _avatarUrl = profile['avatarUrl']?.toString().trim() ?? '';
        _isApproved = profile['isApproved'] == true;
        _isVerified = profile['isVerified'] == true;
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

  Future<void> _pickAndUploadAvatar() async {
    if (_uploadingAvatar) {
      return;
    }

    try {
      final picker = ImagePicker();

      final image = await picker.pickImage(
        source: ImageSource.gallery,
        imageQuality: 88,
        maxWidth: 1400,
        maxHeight: 1400,
      );

      if (image == null || !mounted) {
        return;
      }

      setState(() {
        _uploadingAvatar = true;
      });

      final accessToken = await _token();

      if (accessToken.isEmpty) {
        throw const AstrologerPortalApiException(
          'Your login session has expired. Please login again.',
        );
      }

      final response = await _api.uploadProfileAvatar(
        accessToken: accessToken,
        filePath: image.path,
      );

      final responseData = _data(response);
      final avatarUrl = responseData['avatarUrl']?.toString().trim() ?? '';

      if (avatarUrl.isEmpty) {
        throw const AstrologerPortalApiException(
          'Profile image uploaded but image URL was not returned.',
        );
      }

      if (!mounted) {
        return;
      }

      setState(() {
        _avatarUrl = avatarUrl;
      });

      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(
          const SnackBar(content: Text('Profile photo updated successfully.')),
        );
    } on AstrologerPortalApiException catch (error) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(
          SnackBar(content: Text(error.message), backgroundColor: Colors.red),
        );
    } catch (error) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(
          SnackBar(
            content: Text('Unable to upload profile photo: $error'),
            backgroundColor: Colors.red,
          ),
        );
    } finally {
      if (mounted) {
        setState(() {
          _uploadingAvatar = false;
        });
      }
    }
  }

  Future<void> _save() async {
    FocusScope.of(context).unfocus();

    if (_saving || !_formKey.currentState!.validate()) {
      return;
    }

    final languages = _csv(_languagesController.text);
    final expertise = _csv(_expertiseController.text);

    if (languages.isEmpty || expertise.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Add at least one language and one expertise.'),
        ),
      );

      return;
    }

    final experience = int.tryParse(_experienceController.text.trim());

    final price = double.tryParse(_priceController.text.trim());

    if (experience == null || experience < 0) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Enter valid experience.')));

      return;
    }

    if (price == null || price < 1) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Consultation price must be at least \u20B91 per minute.',
          ),
        ),
      );

      return;
    }

    setState(() {
      _saving = true;
    });

    try {
      final accessToken = await _token();

      final response = await _api.updateProfile(
        accessToken: accessToken,
        profile: {
          'fullName': _nameController.text.trim(),
          'email': _emailController.text.trim(),
          'location': _locationController.text.trim(),
          'bio': _bioController.text.trim(),
          'languages': languages,
          'expertise': expertise,
          'experience': experience,
          'pricePerMin': price,
        },
      );

      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context)
        ..clearSnackBars()
        ..showSnackBar(
          SnackBar(
            content: Text(
              response['message']?.toString() ??
                  'Profile updated successfully.',
            ),
            backgroundColor: Colors.green.shade700,
          ),
        );

      await _loadProfile();
    } on AstrologerPortalApiException catch (error) {
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
    } finally {
      if (mounted) {
        setState(() {
          _saving = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      appBar: AppBar(
        backgroundColor: AppColors.background,
        foregroundColor: AppColors.white,
        title: const Text(
          'Professional Profile',
          style: TextStyle(fontWeight: FontWeight.w900),
        ),
      ),
      body: _loading
          ? const Center(
              child: CircularProgressIndicator(color: AppColors.gold),
            )
          : _error.isNotEmpty
          ? _errorView()
          : _profileForm(),
    );
  }

  Widget _errorView() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(
              Icons.error_outline_rounded,
              color: AppColors.gold,
              size: 46,
            ),
            const SizedBox(height: 14),
            Text(
              _error,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.white),
            ),
            const SizedBox(height: 18),
            FilledButton(onPressed: _loadProfile, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }

  Widget _profileForm() {
    final approved = _isApproved && _isVerified;

    return Form(
      key: _formKey,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 18, 16, 34),
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: const Color(0x44F4C45E)),
            ),
            child: Row(
              children: [
                Container(
                  width: 76,
                  height: 76,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.surfaceLight,
                    border: Border.all(color: AppColors.gold, width: 2),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: _avatarUrl.isNotEmpty
                      ? Image.network(
                          _avatarUrl,
                          fit: BoxFit.cover,
                          errorBuilder: (_, _, _) {
                            return const Icon(
                              Icons.person_rounded,
                              color: AppColors.gold,
                              size: 38,
                            );
                          },
                        )
                      : const Icon(
                          Icons.person_rounded,
                          color: AppColors.gold,
                          size: 38,
                        ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Profile photo',
                        style: TextStyle(
                          color: AppColors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'This photo will be visible to customers.',
                        style: TextStyle(color: AppColors.muted, fontSize: 12),
                      ),
                      const SizedBox(height: 10),
                      OutlinedButton.icon(
                        onPressed: _uploadingAvatar
                            ? null
                            : _pickAndUploadAvatar,
                        icon: _uploadingAvatar
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              )
                            : const Icon(Icons.photo_library_outlined),
                        label: Text(
                          _uploadingAvatar
                              ? 'Uploading...'
                              : (_avatarUrl.isEmpty
                                    ? 'Upload photo'
                                    : 'Change profile photo'),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 18),

          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: const Color(0x44F4C45E)),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  radius: 25,
                  backgroundColor: approved
                      ? const Color(0x2232CD32)
                      : const Color(0x22F4C45E),
                  child: Icon(
                    approved ? Icons.verified_rounded : Icons.pending_outlined,
                    color: approved ? Colors.greenAccent : AppColors.gold,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        approved
                            ? 'Approved & Verified'
                            : 'Profile verification pending',
                        style: const TextStyle(
                          color: AppColors.white,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Keep your professional information accurate for customers.',
                        style: TextStyle(color: AppColors.muted, fontSize: 12),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 18),

          _field(
            controller: _nameController,
            label: 'Full name',
            icon: Icons.person_outline_rounded,
          ),

          _field(
            controller: _emailController,
            label: 'Email',
            icon: Icons.email_outlined,
            keyboardType: TextInputType.emailAddress,
            validator: (value) {
              final text = value?.trim() ?? '';

              if (text.isEmpty || !text.contains('@')) {
                return 'Enter a valid email.';
              }

              return null;
            },
          ),

          _field(
            controller: _locationController,
            label: 'Location',
            icon: Icons.location_on_outlined,
            required: false,
          ),

          _field(
            controller: _languagesController,
            label: 'Languages',
            hint: 'Hindi, English',
            icon: Icons.language_rounded,
          ),

          _field(
            controller: _expertiseController,
            label: 'Expertise',
            hint: 'Vedic Astrology, Numerology',
            icon: Icons.auto_awesome_outlined,
          ),

          _field(
            controller: _experienceController,
            label: 'Experience in years',
            icon: Icons.workspace_premium_outlined,
            keyboardType: TextInputType.number,
          ),

          _field(
            controller: _priceController,
            label: 'Consultation price / minute',
            icon: Icons.currency_rupee_rounded,
            keyboardType: const TextInputType.numberWithOptions(decimal: true),
          ),

          _field(
            controller: _bioController,
            label: 'Professional bio',
            icon: Icons.description_outlined,
            maxLines: 5,
            required: false,
          ),

          const SizedBox(height: 8),

          SizedBox(
            height: 54,
            child: FilledButton.icon(
              onPressed: _saving ? null : _save,
              icon: _saving
                  ? const SizedBox(
                      width: 19,
                      height: 19,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.save_outlined),
              label: Text(_saving ? 'Saving...' : 'Save Professional Profile'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _field({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    String? hint,
    TextInputType? keyboardType,
    bool required = true,
    int maxLines = 1,
    String? Function(String?)? validator,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 13),
      child: TextFormField(
        controller: controller,
        keyboardType: keyboardType,
        maxLines: maxLines,
        style: const TextStyle(color: AppColors.white),
        validator:
            validator ??
            (value) {
              if (required && (value?.trim().isEmpty ?? true)) {
                return '$label is required.';
              }

              return null;
            },
        decoration: InputDecoration(
          labelText: label,
          hintText: hint,
          labelStyle: const TextStyle(color: AppColors.muted),
          hintStyle: const TextStyle(color: AppColors.muted),
          prefixIcon: Icon(icon, color: AppColors.gold),
          filled: true,
          fillColor: AppColors.surface,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(16)),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: Color(0x22FFFFFF)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: AppColors.gold),
          ),
        ),
      ),
    );
  }
}
