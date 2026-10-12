import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import '../../../auth/presentation/screens/welcome_screen.dart';

import '../../../../core/theme/app_theme.dart';
import '../../data/astrologer_portal_api.dart';
import 'astrologer_pending_approval_screen.dart';

// The registration contract calls the bucket-relative storage path url.
Map<String, String> kycDocumentFromUpload(
  Map<String, dynamic> response,
  String expectedType,
) {
  final data = response['data'];
  if (response['success'] != true || data is! Map) {
    throw const AstrologerPortalApiException(
      'Invalid KYC upload response. Please retry.',
    );
  }
  final path = data['path'];
  final name = data['fileName'];
  final type = data['documentType'];
  if (path is! String ||
      name is! String ||
      type != expectedType ||
      !const {'identity', 'certificate', 'experience'}.contains(type) ||
      name.trim().isEmpty ||
      !RegExp(
        r'^[^/\\:]+/(identity|certificate|experience)/[^/\\:]+$',
      ).hasMatch(path) ||
      path.split('/')[1] != type ||
      path.split('/').any((part) => part == '.' || part == '..')) {
    throw const AstrologerPortalApiException(
      'Invalid KYC upload metadata. Please retry.',
    );
  }
  return {'type': type as String, 'name': name.trim(), 'url': path};
}

class AstrologerRegistrationScreen extends StatefulWidget {
  const AstrologerRegistrationScreen({
    required this.phone,
    required this.accessToken,
    this.canonicalEmail,
    super.key,
  });

  final String phone;
  final String accessToken;
  final String? canonicalEmail;

  @override
  State<AstrologerRegistrationScreen> createState() =>
      _AstrologerRegistrationScreenState();
}

class _AstrologerRegistrationScreenState
    extends State<AstrologerRegistrationScreen> {
  final _formKey = GlobalKey<FormState>();
  final _api = AstrologerPortalApi();

  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _languagesController = TextEditingController();
  final _expertiseController = TextEditingController();
  final _experienceController = TextEditingController();
  final _priceController = TextEditingController();
  final _bioController = TextEditingController();
  static const List<String> _languageOptions = [
    'Hindi',
    'English',
    'Bengali',
    'Marathi',
    'Tamil',
    'Telugu',
    'Kannada',
    'Malayalam',
    'Gujarati',
    'Punjabi',
  ];

  static const List<String> _expertiseOptions = [
    'Vedic Astrology',
    'Numerology',
    'Tarot',
    'Vastu',
    'KP Astrology',
    'Nadi Astrology',
    'Palmistry',
    'Prashna',
    'Lal Kitab',
  ];

  final List<String> _selectedLanguages = [];
  final List<String> _selectedExpertise = [];

  final Map<String, Map<String, String>> _documents = {};

  String? get _identityProofPath => _documents['identity']?['url'];
  String? get _identityProofName => _documents['identity']?['name'];
  String? get _certificatePath => _documents['certificate']?['url'];
  String? get _certificateName => _documents['certificate']?['name'];
  String? get _experienceProofPath => _documents['experience']?['url'];
  String? get _experienceProofName => _documents['experience']?['name'];

  bool _uploadingIdentity = false;
  bool _uploadingCertificate = false;
  bool _uploadingExperience = false;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _emailController.text = widget.canonicalEmail ?? '';
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _languagesController.dispose();
    _expertiseController.dispose();
    _experienceController.dispose();
    _priceController.dispose();
    _bioController.dispose();
    _api.close();
    super.dispose();
  }

  List<String> _csv(String source) {
    return source
        .split(',')
        .map((item) => item.trim())
        .where((item) => item.isNotEmpty)
        .toSet()
        .toList();
  }

  Future<void> _pickAndUploadKyc(String type) async {
    final result = await FilePicker.platform.pickFiles(
      allowMultiple: false,
      withData: false,
      type: FileType.custom,
      allowedExtensions: const ['jpg', 'jpeg', 'png', 'pdf'],
    );

    if (result == null || result.files.isEmpty) {
      return;
    }

    final file = result.files.single;
    final path = file.path?.trim() ?? '';

    if (path.isEmpty) {
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Unable to access selected file.')),
      );
      return;
    }

    setState(() {
      if (type == 'identity') {
        _uploadingIdentity = true;
      } else if (type == 'certificate') {
        _uploadingCertificate = true;
      } else {
        _uploadingExperience = true;
      }
    });

    try {
      final response = await _api.uploadKycDocument(
        accessToken: widget.accessToken,
        filePath: path,
        documentType: type,
      );

      final document = kycDocumentFromUpload(response, type);
      if (!mounted) return;

      setState(() {
        _documents[type] = document;
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('${file.name} uploaded successfully.')),
      );
    } on AstrologerPortalApiException catch (error) {
      if (!mounted) return;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.message),
          backgroundColor: Colors.red.shade700,
        ),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Unable to upload KYC document. Please retry.'),
        ),
      );
    } finally {
      if (mounted) {
        setState(() {
          if (type == 'identity') {
            _uploadingIdentity = false;
          } else if (type == 'certificate') {
            _uploadingCertificate = false;
          } else {
            _uploadingExperience = false;
          }
        });
      }
    }
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();

    if (_submitting ||
        _uploadingIdentity ||
        _uploadingCertificate ||
        _uploadingExperience ||
        !_formKey.currentState!.validate()) {
      return;
    }

    final languages = _csv(_languagesController.text);
    final expertise = _csv(_expertiseController.text);
    if (_identityProofPath == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please upload your identity proof before submitting.'),
        ),
      );
      return;
    }

    if (languages.isEmpty || expertise.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Please add at least one language and one expertise category.',
          ),
        ),
      );
      return;
    }

    setState(() {
      _submitting = true;
    });

    try {
      final response = await _api.register(
        accessToken: widget.accessToken,
        fullName: _nameController.text,
        email: _emailController.text,
        phoneNumber: widget.phone,
        languages: languages,
        expertise: expertise,
        experienceYears: int.parse(_experienceController.text.trim()),
        consultationPrice: double.parse(_priceController.text.trim()),
        bio: _bioController.text,
        documents: {
          'identityProof': _documents['identity']!,
          'certificates': [
            if (_documents['certificate'] != null) _documents['certificate']!,
          ],
          'experienceProofs': [
            if (_documents['experience'] != null) _documents['experience']!,
          ],
        },
      );

      if (!mounted) {
        return;
      }

      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute<void>(
          builder: (_) => AstrologerPendingApprovalScreen(
            message: response['message']?.toString(),
          ),
        ),
        (route) => false,
      );
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
          _submitting = false;
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
          'Join as Astrologer',
          style: TextStyle(fontWeight: FontWeight.w900),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(18, 18, 18, 32),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(22),
                  border: Border.all(color: const Color(0x44F4C45E)),
                ),
                child: const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Build your professional profile',
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    SizedBox(height: 7),
                    Text(
                      'Complete your application. Your profile will go live only after admin verification and approval.',
                      style: TextStyle(color: AppColors.muted, height: 1.4),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              _field(
                controller: _nameController,
                label: 'Full name',
                icon: Icons.person_outline_rounded,
              ),

              TextFormField(
                controller: _emailController,
                readOnly: true,
                decoration: _decoration(
                  'Account email (if linked)',
                  Icons.email_outlined,
                ),
              ),

              TextFormField(
                initialValue: widget.phone,
                readOnly: true,
                style: const TextStyle(color: AppColors.white),
                decoration: _decoration(
                  'Verified mobile number',
                  Icons.phone_android_rounded,
                ),
              ),
              _multiSelectField(
                title: 'Languages',
                icon: Icons.language_rounded,
                options: _languageOptions,
                selectedValues: _selectedLanguages,
              ),

              const SizedBox(height: 13),

              _multiSelectField(
                title: 'Expertise',
                icon: Icons.auto_awesome_outlined,
                options: _expertiseOptions,
                selectedValues: _selectedExpertise,
              ),

              const SizedBox(height: 13),

              _field(
                controller: _experienceController,
                label: 'Experience in years',
                icon: Icons.workspace_premium_outlined,
                keyboardType: TextInputType.number,
                validator: (value) {
                  final number = int.tryParse(value?.trim() ?? '');

                  if (number == null || number < 0) {
                    return 'Enter valid experience in years.';
                  }

                  return null;
                },
              ),

              _field(
                controller: _priceController,
                label: 'Consultation price per minute',
                icon: Icons.currency_rupee_rounded,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                validator: (value) {
                  final number = double.tryParse(value?.trim() ?? '');

                  if (number == null || number < 0) {
                    return 'Enter a valid consultation price.';
                  }

                  return null;
                },
              ),

              _field(
                controller: _bioController,
                label: 'Professional bio',
                hint: 'Tell customers about your astrology experience',
                icon: Icons.description_outlined,
                required: false,
                maxLines: 4,
              ),

              const SizedBox(height: 8),

              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: const Color(0x22FFFFFF)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'KYC & Verification',
                      style: TextStyle(
                        color: AppColors.white,
                        fontSize: 17,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 6),
                    const Text(
                      'Upload JPG, PNG or PDF documents. Identity proof is required.',
                      style: TextStyle(color: AppColors.muted, height: 1.4),
                    ),
                    const SizedBox(height: 16),

                    _kycTile(
                      title: 'Identity Proof',
                      subtitle: _identityProofName ?? 'Required',
                      icon: Icons.badge_outlined,
                      loading: _uploadingIdentity,
                      completed: _identityProofPath != null,
                      onTap: () => _pickAndUploadKyc('identity'),
                    ),

                    const SizedBox(height: 12),

                    _kycTile(
                      title: 'Astrology Certificate',
                      subtitle: _certificateName ?? 'Optional',
                      icon: Icons.workspace_premium_outlined,
                      loading: _uploadingCertificate,
                      completed: _certificatePath != null,
                      onTap: () => _pickAndUploadKyc('certificate'),
                    ),

                    const SizedBox(height: 12),

                    _kycTile(
                      title: 'Experience Proof',
                      subtitle: _experienceProofName ?? 'Optional',
                      icon: Icons.history_edu_outlined,
                      loading: _uploadingExperience,
                      completed: _experienceProofPath != null,
                      onTap: () => _pickAndUploadKyc('experience'),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 18),

              SizedBox(
                height: 54,
                child: FilledButton.icon(
                  onPressed: _submitting ? null : _submit,
                  icon: _submitting
                      ? const SizedBox(
                          width: 19,
                          height: 19,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.send_rounded),
                  label: Text(
                    _submitting
                        ? 'Submitting application...'
                        : 'Submit for Admin Approval',
                  ),
                ),
              ),

              const SizedBox(height: 10),

              TextButton(
                onPressed: _submitting
                    ? null
                    : () {
                        Navigator.of(context).pushAndRemoveUntil(
                          MaterialPageRoute<void>(
                            builder: (_) => const WelcomeScreen(),
                          ),
                          (route) => false,
                        );
                      },
                child: const Text('Skip for now'),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _multiSelectField({
    required String title,
    required IconData icon,
    required List<String> options,
    required List<String> selectedValues,
  }) {
    return InkWell(
      onTap: () async {
        final draft = List<String>.from(selectedValues);

        final result = await showModalBottomSheet<List<String>>(
          context: context,
          isScrollControlled: true,
          backgroundColor: AppColors.surface,
          shape: const RoundedRectangleBorder(
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          builder: (sheetContext) {
            return StatefulBuilder(
              builder: (context, setModalState) {
                return SafeArea(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(18, 18, 18, 24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          'Select $title',
                          style: const TextStyle(
                            color: AppColors.white,
                            fontSize: 20,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        const SizedBox(height: 14),
                        Flexible(
                          child: SingleChildScrollView(
                            child: Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: options.map((option) {
                                final selected = draft.contains(option);

                                return FilterChip(
                                  label: Text(option),
                                  selected: selected,
                                  onSelected: (value) {
                                    setModalState(() {
                                      if (value) {
                                        if (!draft.contains(option)) {
                                          draft.add(option);
                                        }
                                      } else {
                                        draft.remove(option);
                                      }
                                    });
                                  },
                                );
                              }).toList(),
                            ),
                          ),
                        ),
                        const SizedBox(height: 18),
                        FilledButton(
                          onPressed: () {
                            Navigator.of(sheetContext).pop(draft);
                          },
                          child: const Text('Done'),
                        ),
                      ],
                    ),
                  ),
                );
              },
            );
          },
        );

        if (result == null || !mounted) return;

        setState(() {
          selectedValues
            ..clear()
            ..addAll(result);
        });
      },
      borderRadius: BorderRadius.circular(16),
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 15),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0x22FFFFFF)),
        ),
        child: Row(
          children: [
            Icon(icon, color: AppColors.gold),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                selectedValues.isEmpty
                    ? 'Select $title'
                    : selectedValues.join(', '),
                style: TextStyle(
                  color: selectedValues.isEmpty
                      ? AppColors.muted
                      : AppColors.white,
                ),
              ),
            ),
            const Icon(
              Icons.keyboard_arrow_down_rounded,
              color: AppColors.gold,
            ),
          ],
        ),
      ),
    );
  }

  Widget _kycTile({
    required String title,
    required String subtitle,
    required IconData icon,
    required bool loading,
    required bool completed,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: loading ? null : onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(0x11000000),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: completed
                ? const Color(0x66F4C45E)
                : const Color(0x22FFFFFF),
          ),
        ),
        child: Row(
          children: [
            Icon(
              completed ? Icons.check_circle_rounded : icon,
              color: AppColors.gold,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      color: AppColors.white,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            if (loading)
              const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            else
              Icon(
                completed ? Icons.refresh_rounded : Icons.upload_file_rounded,
                color: AppColors.gold,
              ),
          ],
        ),
      ),
    );
  }

  Widget _field({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    String? hint,
    TextInputType? keyboardType,
    String? Function(String?)? validator,
    bool required = true,
    int maxLines = 1,
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
        decoration: _decoration(label, icon, hint: hint),
      ),
    );
  }

  InputDecoration _decoration(String label, IconData icon, {String? hint}) {
    return InputDecoration(
      labelText: label,
      hintText: hint,
      labelStyle: const TextStyle(color: AppColors.muted),
      hintStyle: const TextStyle(color: AppColors.muted),
      prefixIcon: Icon(icon, color: AppColors.gold),
      filled: true,
      fillColor: AppColors.surface,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: Color(0x22FFFFFF)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: AppColors.gold),
      ),
    );
  }
}
