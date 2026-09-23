/// Profile setup screen — first-time user must complete this before matching.
/// Fields: nickname (3-40 chars), birthYear (18+), gender, country, avatar (optional).
/// Avatar upload: pick image → upload to S3 via presigned PUT → patch profile.

import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';
import 'package:country_picker/country_picker.dart';
import '../../i18n/strings.dart';
import '../../core/network/api_client.dart';

class ProfileSetupPage extends ConsumerStatefulWidget {
  const ProfileSetupPage({super.key});

  @override
  ConsumerState<ProfileSetupPage> createState() => _ProfileSetupPageState();
}

class _ProfileSetupPageState extends ConsumerState<ProfileSetupPage> {
  final _nicknameCtrl = TextEditingController();
  final _birthYearCtrl = TextEditingController();
  String? _gender;
  String? _countryCode;
  XFile? _avatarFile;
  String? _avatarUrl;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _nicknameCtrl.dispose();
    _birthYearCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickAvatar() async {
    final picker = ImagePicker();
    final x = await picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 512,
      maxHeight: 512,
      imageQuality: 80,
    );
    if (x != null) {
      setState(() => _avatarFile = x);
    }
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final nickname = _nicknameCtrl.text.trim();
      if (nickname.length < 3 || nickname.length > 40) {
        throw Exception(t.profileSetupNicknameHint);
      }
      final birthYear = int.tryParse(_birthYearCtrl.text.trim());
      if (birthYear == null) {
        throw Exception(t.profileSetupBirthYearHint);
      }
      final age = DateTime.now().year - birthYear;
      if (age < 18) {
        throw Exception(t.profileSetupUnderageBlocked);
      }

      String? avatarUrl;
      if (_avatarFile != null) {
        final bytes = await _avatarFile!.readAsBytes();
        final ext = _avatarFile!.name.split('.').last.toLowerCase();
        final contentType = ext == 'png'
            ? 'image/png'
            : ext == 'webp'
                ? 'image/webp'
                : 'image/jpeg';
        avatarUrl = await ApiClient.uploadAvatar(
          bytes: bytes,
          contentType: contentType,
          ext: ext,
        );
      }

      await ApiClient.updateProfile({
        'displayName': nickname,
        'birthYear': birthYear,
        if (_gender != null) 'gender': _gender,
        if (_countryCode != null) 'country': _countryCode,
        if (avatarUrl != null) 'avatarUrl': avatarUrl,
      });

      if (!mounted) return;
      // After profile setup → agreements acceptance → home.
      context.go('/agreements');
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  void _pickCountry() {
    showCountryPicker(
      context: context,
      showPhoneCode: false,
      onSelect: (country) {
        setState(() {
          _countryCode = country.countryCode;
        });
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final i18n = t;
    return Scaffold(
      backgroundColor: const Color(0xFF0B0B0B),
      appBar: AppBar(
        title: Text(i18n.profileSetupTitle),
        backgroundColor: const Color(0xFF0B0B0B),
        foregroundColor: Colors.white,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 400),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Avatar
                GestureDetector(
                  onTap: _pickAvatar,
                  child: Container(
                    width: 120,
                    height: 120,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: const Color(0xFF1C1C1E),
                      border: Border.all(color: Colors.white24),
                    ),
                    child: _avatarFile != null
                        ? ClipOval(
                            child: Image.file(
                              File(_avatarFile!.path),
                              fit: BoxFit.cover,
                            ),
                          )
                        : (_avatarUrl != null
                            ? ClipOval(
                                child: Image.network(
                                  _avatarUrl!,
                                  fit: BoxFit.cover,
                                ),
                              )
                            : const Icon(
                                Icons.camera_alt,
                                color: Colors.white54,
                                size: 36,
                              )),
                  ),
                ),
                const SizedBox(height: 8),
                if (_avatarFile != null)
                  TextButton(
                    onPressed: () => setState(() => _avatarFile = null),
                    child: Text(
                      i18n.profileSetupAvatarRemove,
                      style: const TextStyle(color: Colors.redAccent),
                    ),
                  ),
                const SizedBox(height: 24),

                // Nickname
                TextField(
                  controller: _nicknameCtrl,
                  style: const TextStyle(color: Colors.white),
                  decoration: _inputDecoration(i18n.profileSetupNickname, i18n.profileSetupNicknameHint),
                ),
                const SizedBox(height: 16),

                // Birth year
                TextField(
                  controller: _birthYearCtrl,
                  keyboardType: TextInputType.number,
                  style: const TextStyle(color: Colors.white),
                  decoration: _inputDecoration(i18n.profileSetupBirthYear, i18n.profileSetupBirthYearHint),
                ),
                const SizedBox(height: 16),

                // Gender
                Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    i18n.profileSetupGender,
                    style: const TextStyle(color: Colors.white70, fontSize: 12),
                  ),
                ),
                Wrap(
                  spacing: 8,
                  children: [
                    ChoiceChip(
                      label: Text(i18n.profileSetupGenderMale),
                      selected: _gender == 'MALE',
                      onSelected: (_) => setState(() => _gender = 'MALE'),
                    ),
                    ChoiceChip(
                      label: Text(i18n.profileSetupGenderFemale),
                      selected: _gender == 'FEMALE',
                      onSelected: (_) => setState(() => _gender = 'FEMALE'),
                    ),
                    ChoiceChip(
                      label: Text(i18n.profileSetupGenderOther),
                      selected: _gender == 'OTHER',
                      onSelected: (_) => setState(() => _gender = 'OTHER'),
                    ),
                    ChoiceChip(
                      label: Text(i18n.profileSetupGenderUnspecified),
                      selected: _gender == 'UNSPECIFIED',
                      onSelected: (_) => setState(() => _gender = 'UNSPECIFIED'),
                    ),
                  ],
                ),
                const SizedBox(height: 24),

                // Country
                ListTile(
                  title: Text(
                    _countryCode ?? i18n.profileSetupCountryHint,
                    style: const TextStyle(color: Colors.white),
                  ),
                  trailing: const Icon(Icons.chevron_right, color: Colors.white54),
                  onTap: _pickCountry,
                  tileColor: const Color(0xFF1C1C1E),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                const SizedBox(height: 32),

                if (_error != null) ...[
                  Text(
                    _error!,
                    style: const TextStyle(color: Colors.redAccent),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 12),
                ],

                FilledButton(
                  onPressed: _saving ? null : _save,
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFFFF3B30),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                  ),
                  child: _saving
                      ? Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                            ),
                            const SizedBox(width: 12),
                            Text(i18n.profileSetupSaving),
                          ],
                        )
                      : Text(i18n.profileSetupSave),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  InputDecoration _inputDecoration(String label, String hint) {
    return InputDecoration(
      labelText: label,
      labelStyle: const TextStyle(color: Colors.white54),
      hintText: hint,
      hintStyle: const TextStyle(color: Colors.white30),
      enabledBorder: OutlineInputBorder(
        borderSide: const BorderSide(color: Colors.white24),
        borderRadius: BorderRadius.circular(12),
      ),
      focusedBorder: OutlineInputBorder(
        borderSide: const BorderSide(color: Color(0xFFFF3B30)),
        borderRadius: BorderRadius.circular(12),
      ),
    );
  }
}
