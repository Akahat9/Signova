import 'dart:async';

import 'package:flutter/material.dart';

import '../data/auth_repository.dart';

class VerifyEmailScreen extends StatefulWidget {
  const VerifyEmailScreen({required this.auth, required this.email, super.key});

  final AuthRepository auth;
  final String email;

  @override
  State<VerifyEmailScreen> createState() => _VerifyEmailScreenState();
}

class _VerifyEmailScreenState extends State<VerifyEmailScreen> {
  Timer? _cooldownTimer;
  int _resendCooldown = 0;
  bool _busy = false;
  String? _message;

  Future<void> _checkVerification() async {
    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      final user = await widget.auth.reloadCurrentUser();
      if (!mounted) return;
      setState(() => _message = user?.emailVerified == true
          ? 'Email verified. Opening your Signova account…'
          : 'We have not received the verification yet. Open the email link, then check again.');
    } catch (_) {
      if (mounted) setState(() => _message = 'Could not check verification. Check your connection and try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _resendVerification() async {
    if (_busy || _resendCooldown > 0) return;
    setState(() {
      _busy = true;
      _message = null;
    });
    try {
      await widget.auth.sendVerificationEmail();
      if (!mounted) return;
      setState(() => _message = 'Verification email sent. Check your inbox and spam folder.');
      _startCooldown();
    } catch (_) {
      if (mounted) setState(() => _message = 'Could not send the email. Check your connection and try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _startCooldown() {
    _cooldownTimer?.cancel();
    setState(() => _resendCooldown = 30);
    _cooldownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      if (_resendCooldown <= 1) {
        timer.cancel();
        setState(() => _resendCooldown = 0);
      } else {
        setState(() => _resendCooldown--);
      }
    });
  }

  Future<void> _signOut() => widget.auth.signOut();

  @override
  void dispose() {
    _cooldownTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        body: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: ListView(
                shrinkWrap: true,
                padding: const EdgeInsets.all(24),
                children: [
                  const Icon(Icons.mark_email_read_outlined, size: 64, color: Color(0xff147de1)),
                  const SizedBox(height: 20),
                  Text('Verify your email', style: Theme.of(context).textTheme.headlineMedium, textAlign: TextAlign.center),
                  const SizedBox(height: 10),
                  Text('We sent a verification link to ${widget.email}. Verify it to continue to Signova.', textAlign: TextAlign.center),
                  if (_message != null) ...[
                    const SizedBox(height: 16),
                    Semantics(liveRegion: true, child: Text(_message!, textAlign: TextAlign.center)),
                  ],
                  const SizedBox(height: 24),
                  FilledButton.icon(
                    onPressed: _busy ? null : _checkVerification,
                    icon: const Icon(Icons.verified_outlined),
                    label: Text(_busy ? 'Checking…' : 'I have verified my email'),
                  ),
                  OutlinedButton(
                    onPressed: _busy || _resendCooldown > 0 ? null : _resendVerification,
                    child: Text(_resendCooldown > 0 ? 'Resend email in ${_resendCooldown}s' : 'Resend verification email'),
                  ),
                  TextButton(onPressed: _busy ? null : _signOut, child: const Text('Sign out')),
                ],
              ),
            ),
          ),
        ),
      );
}
