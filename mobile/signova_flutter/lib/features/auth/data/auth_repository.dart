import 'package:firebase_auth/firebase_auth.dart';

/// Firebase Authentication adapter for the mobile auth feature.
///
/// UI code uses this boundary instead of calling FirebaseAuth directly. Access
/// control is still enforced by Firestore/Storage Rules and backend token
/// verification; checks in this repository improve client navigation only.
class AuthRepository {
  AuthRepository({FirebaseAuth? auth}) : _auth = auth ?? FirebaseAuth.instance;

  final FirebaseAuth _auth;

  User? get currentUser => _auth.currentUser;

  Stream<User?> get userChanges => _auth.userChanges();

  Future<UserCredential> signIn({required String email, required String password}) {
    return _auth.signInWithEmailAndPassword(
      email: email.trim(),
      password: password,
    );
  }

  Future<UserCredential> createAccount({required String email, required String password}) {
    return _auth.createUserWithEmailAndPassword(
      email: email.trim(),
      password: password,
    );
  }

  Future<void> sendVerificationEmail() async {
    final user = _auth.currentUser;
    if (user == null) throw StateError('Sign in before requesting email verification.');
    await user.sendEmailVerification();
  }

  Future<User?> reloadCurrentUser() async {
    final user = _auth.currentUser;
    if (user == null) return null;
    await user.reload();
    return _auth.currentUser;
  }

  Future<void> sendPasswordReset({required String email}) {
    return _auth.sendPasswordResetEmail(email: email.trim());
  }

  Future<String> requireVerifiedIdToken() async {
    final user = _auth.currentUser;
    if (user == null) throw StateError('Sign in is required.');
    if (!user.emailVerified) throw StateError('Verify your email before continuing.');
    final token = await user.getIdToken(true);
    if (token == null || token.isEmpty) throw StateError('Could not obtain an authentication token.');
    return token;
  }

  Future<void> signOut() => _auth.signOut();

  static String messageForAuthError(FirebaseAuthException error) {
    switch (error.code) {
      case 'invalid-email':
        return 'Enter a valid email address.';
      case 'email-already-in-use':
        return 'An account already exists for this email. Try signing in.';
      case 'weak-password':
        return 'Choose a stronger password with at least 6 characters.';
      case 'user-disabled':
        return 'This account is disabled. Contact Signova support.';
      case 'user-not-found':
      case 'wrong-password':
      case 'invalid-credential':
        return 'Email or password is incorrect.';
      case 'too-many-requests':
        return 'Too many attempts. Wait a little and try again.';
      case 'network-request-failed':
        return 'Network connection failed. Check your connection and retry.';
      case 'operation-not-allowed':
        return 'Email and password sign-in is not enabled for this Firebase project yet.';
      default:
        return 'Authentication could not be completed. Please try again.';
    }
  }
}
