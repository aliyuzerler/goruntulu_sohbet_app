/// Login screen — phone OTP entry + Google Sign-In button.
/// Phase 2 dev mode: any OTP is accepted for whitelisted phones (server-side).
/// In production, the user taps "Send code" → firebase_auth sends OTP SMS →
/// user enters 6 digits → idToken sent to /auth/verify-phone.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../i18n/strings.dart';
import '../auth/auth_provider.dart';

class LoginPage extends ConsumerStatefulWidget {
  const LoginPage({super.key});

  @override
  ConsumerState<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends ConsumerState<LoginPage> {
  final _phoneCtrl = TextEditingController();
  final _otpCtrl = TextEditingController();
  bool _otpSent = false;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _phoneCtrl.dispose();
    _otpCtrl.dispose();
    super.dispose();
  }

  Future<void> _sendCode() async {
    final phone = _phoneCtrl.text.trim();
    if (!RegExp(r'^\+\d{10,15}$').hasMatch(phone)) {
      setState(() => _error = t.loginInvalidPhone);
      return;
    }
    setState(() {
      _error = null;
      _otpSent = true;
    });
    // Dev bypass: no actual SMS. Production: firebase_auth.verifyPhoneNumber().
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(t.loginOtpSent)),
    );
  }

  Future<void> _verifyOtp() async {
    final phone = _phoneCtrl.text.trim();
    final otp = _otpCtrl.text.trim();
    if (otp.length != 6) {
      setState(() => _error = t.loginInvalidOtp);
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    await ref.read(authProvider.notifier).loginWithPhone(phone: phone, otp: otp);
    final state = ref.read(authProvider);
    setState(() => _busy = false);
    if (state is Authenticated) {
      // Route to either profile setup (if not completed) or home.
      if (state.user.profileCompleted) {
        context.go('/home');
      } else {
        context.go('/profile-setup');
      }
    } else if (state is AuthError) {
      setState(() => _error = state.message);
    }
  }

  Future<void> _googleSignIn() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    // Dev bypass: send a fake idToken string. The server accepts any string
    // and derives a stable subject from its hash.
    // Production: GoogleSignIn().signIn().then((account) => account.idToken)
    const fakeIdToken = 'dev-google-idtoken-phase2';
    await ref.read(authProvider.notifier).loginWithGoogle(idToken: fakeIdToken);
    final state = ref.read(authProvider);
    setState(() => _busy = false);
    if (state is Authenticated) {
      if (state.user.profileCompleted) {
        context.go('/home');
      } else {
        context.go('/profile-setup');
      }
    } else if (state is AuthError) {
      setState(() => _error = state.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final i18n = t;
    return Scaffold(
      backgroundColor: const Color(0xFF0B0B0B),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 400),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SizedBox(height: 80),
                Container(
                  width: 88,
                  height: 88,
                  decoration: const BoxDecoration(
                    color: Color(0xFFFF3B30),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.videocam, color: Colors.white, size: 44),
                ),
                const SizedBox(height: 24),
                Text(
                  i18n.loginTitle,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                      ),
                ),
                const SizedBox(height: 8),
                Text(
                  i18n.loginSubtitle,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white70),
                ),
                const SizedBox(height: 40),
                TextField(
                  controller: _phoneCtrl,
                  keyboardType: TextInputType.phone,
                  enabled: !_otpSent,
                  style: const TextStyle(color: Colors.white),
                  decoration: InputDecoration(
                    labelText: i18n.loginPhone,
                    labelStyle: const TextStyle(color: Colors.white54),
                    hintText: i18n.loginPhoneHint,
                    hintStyle: const TextStyle(color: Colors.white30),
                    enabledBorder: OutlineInputBorder(
                      borderSide: const BorderSide(color: Colors.white24),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderSide: const BorderSide(color: Color(0xFFFF3B30)),
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                if (_otpSent) ...[
                  TextField(
                    controller: _otpCtrl,
                    keyboardType: TextInputType.number,
                    style: const TextStyle(color: Colors.white),
                    decoration: InputDecoration(
                      labelText: i18n.loginOtp,
                      labelStyle: const TextStyle(color: Colors.white54),
                      hintText: i18n.loginOtpHint,
                      hintStyle: const TextStyle(color: Colors.white30),
                      enabledBorder: OutlineInputBorder(
                        borderSide: const BorderSide(color: Colors.white24),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderSide: const BorderSide(color: Color(0xFFFF3B30)),
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                if (_error != null) ...[
                  Text(
                    _error!,
                    style: const TextStyle(color: Colors.redAccent),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 12),
                ],
                FilledButton(
                  onPressed: _busy
                      ? null
                      : _otpSent
                          ? _verifyOtp
                          : _sendCode,
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFFFF3B30),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: Text(_otpSent ? i18n.loginVerifyOtp : i18n.loginSendCode),
                ),
                if (_busy) ...[
                  const SizedBox(height: 12),
                  const Center(child: CircularProgressIndicator(color: Colors.white)),
                ],
                const SizedBox(height: 24),
                Row(
                  children: const [
                    Expanded(child: Divider(color: Colors.white24)),
                    Padding(
                      padding: EdgeInsets.symmetric(horizontal: 16),
                      child: Text(
                        'VEYA',
                        style: TextStyle(color: Colors.white54),
                      ),
                    ),
                    Expanded(child: Divider(color: Colors.white24)),
                  ],
                ),
                const SizedBox(height: 24),
                OutlinedButton.icon(
                  onPressed: _busy ? null : _googleSignIn,
                  icon: const Icon(Icons.g_mobile_rounded, color: Colors.white),
                  label: Text(
                    i18n.loginGoogleSignIn,
                    style: const TextStyle(color: Colors.white),
                  ),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    side: const BorderSide(color: Colors.white24),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
