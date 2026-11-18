import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../data/auth_repository.dart';

class SignInScreen extends StatefulWidget {
  const SignInScreen({required this.auth, super.key});

  final AuthRepository auth;

  @override
  State<SignInScreen> createState() => _SignInScreenState();
}

class _SignInScreenState extends State<SignInScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _creatingAccount = false;
  bool _showPassword = false;
  bool _busy = false;
  String? _error;

  Future<void> _submit() async {
    if (_busy || !(_formKey.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      if (_creatingAccount) {
        await widget.auth.createAccount(email: _email.text, password: _password.text);
        await widget.auth.sendVerificationEmail();
      } else {
        await widget.auth.signIn(email: _email.text, password: _password.text);
      }
      // AuthStateGate routes new accounts to the verification screen and
      // verified accounts into the app as the Firebase user stream updates.
    } on FirebaseAuthException catch (error) {
      if (mounted) setState(() => _error = AuthRepository.messageForAuthError(error));
    } on StateError catch (error) {
      if (mounted) setState(() => _error = error.message.toString());
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not connect to Signova. Please try again.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _resetPassword() async {
    final email = _email.text.trim();
    if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) {
      setState(() => _error = 'Enter your email above, then tap “Forgot password?”.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.auth.sendPasswordReset(email: email);
      if (mounted) _showMessage('If an account exists for that email, a reset link has been sent.');
    } on FirebaseAuthException catch (error) {
      if (mounted) setState(() => _error = AuthRepository.messageForAuthError(error));
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not request a reset link. Check your connection and retry.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  void _showMessage(String message) {
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        body: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Form(
                key: _formKey,
                autovalidateMode: AutovalidateMode.onUserInteraction,
                child: ListView(
                  shrinkWrap: true,
                  padding: const EdgeInsets.all(24),
                  children: [
                    const Icon(Icons.waving_hand_rounded, size: 58, color: Color(0xff147de1)),
                    const SizedBox(height: 16),
                    Text(
                      _creatingAccount ? 'Create your Signova account' : 'Welcome to Signova',
                      style: Theme.of(context).textTheme.headlineMedium,
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _creatingAccount
                          ? 'Create an account, then verify your email to continue.'
                          : 'Sign in to learn signs and connect with people.',
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 28),
                    TextFormField(
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      textInputAction: TextInputAction.next,
                      autofillHints: const [AutofillHints.email],
                      autocorrect: false,
                      decoration: const InputDecoration(labelText: 'Email', border: OutlineInputBorder(), prefixIcon: Icon(Icons.email_outlined)),
                      validator: (value) {
                        final email = (value ?? '').trim();
                        if (email.isEmpty) return 'Enter your email.';
                        if (!RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(email)) return 'Enter a valid email address.';
                        return null;
                      },
                    ),
                    const SizedBox(height: 14),
                    TextFormField(
                      controller: _password,
                      obscureText: !_showPassword,
                      textInputAction: TextInputAction.done,
                      autofillHints: _creatingAccount ? const [AutofillHints.newPassword] : const [AutofillHints.password],
                      onFieldSubmitted: (_) => _submit(),
                      decoration: InputDecoration(
                        labelText: 'Password',
                        border: const OutlineInputBorder(),
                        prefixIcon: const Icon(Icons.lock_outline),
                        suffixIcon: IconButton(
                          tooltip: _showPassword ? 'Hide password' : 'Show password',
                          onPressed: () => setState(() => _showPassword = !_showPassword),
                          icon: Icon(_showPassword ? Icons.visibility_off_outlined : Icons.visibility_outlined),
                        ),
                      ),
                      validator: (value) {
                        final password = value ?? '';
                        if (password.isEmpty) return 'Enter your password.';
                        if (_creatingAccount && password.length < 6) return 'Use at least 6 characters.';
                        return null;
                      },
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 12),
                      Semantics(liveRegion: true, child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error))),
                    ],
                    const SizedBox(height: 20),
                    FilledButton(
                      onPressed: _busy ? null : _submit,
                      child: _busy
                          ? const SizedBox.square(dimension: 20, child: CircularProgressIndicator(strokeWidth: 2))
                          : Text(_creatingAccount ? 'Create account' : 'Sign in'),
                    ),
                    if (!_creatingAccount)
                      TextButton(onPressed: _busy ? null : _resetPassword, child: const Text('Forgot password?')),
                    TextButton(
                      onPressed: _busy
                          ? null
                          : () => setState(() {
                                _creatingAccount = !_creatingAccount;
                                _error = null;
                                _formKey.currentState?.reset();
                              }),
                      child: Text(_creatingAccount ? 'Already have an account? Sign in' : 'Create an account'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
}
