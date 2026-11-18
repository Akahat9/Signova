import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../features/auth/data/auth_repository.dart';
import '../features/auth/presentation/sign_in_screen.dart';
import '../features/auth/presentation/verify_email_screen.dart';
import '../features/home/presentation/home_screen.dart';

class SignovaApp extends StatefulWidget {
  const SignovaApp({this.auth, super.key});

  final AuthRepository? auth;

  @override
  State<SignovaApp> createState() => _SignovaAppState();
}

class _SignovaAppState extends State<SignovaApp> {
  late final AuthRepository _auth = widget.auth ?? AuthRepository();

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'Signova',
        debugShowCheckedModeBanner: false,
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(
            seedColor: const Color(0xff147de1),
            surface: const Color(0xfff7faff),
          ),
          useMaterial3: true,
          scaffoldBackgroundColor: const Color(0xfff4f8fc),
          appBarTheme: const AppBarTheme(
            backgroundColor: Color(0xfff4f8fc),
            foregroundColor: Color(0xff14233d),
            centerTitle: false,
            elevation: 0,
          ),
          cardTheme: CardThemeData(
            color: Colors.white,
            elevation: 0,
            margin: EdgeInsets.zero,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(20),
              side: const BorderSide(color: Color(0xffdce7f3)),
            ),
          ),
          inputDecorationTheme: InputDecorationTheme(
            filled: true,
            fillColor: Colors.white,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: const BorderSide(color: Color(0xffdce7f3)),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: const BorderSide(color: Color(0xffdce7f3)),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: const BorderSide(color: Color(0xff147de1), width: 1.5),
            ),
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
          ),
          navigationBarTheme: NavigationBarThemeData(
            backgroundColor: Colors.white,
            indicatorColor: const Color(0xffdceeff),
            labelTextStyle: WidgetStateProperty.resolveWith((states) => TextStyle(
                  fontWeight: states.contains(WidgetState.selected) ? FontWeight.w700 : FontWeight.w500,
                )),
          ),
        ),
        home: StreamBuilder<User?>(
          stream: _auth.userChanges,
          builder: (context, snapshot) {
            if (snapshot.hasError) {
              return const _AuthUnavailableScreen();
            }
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Scaffold(body: Center(child: CircularProgressIndicator()));
            }
            final user = snapshot.data;
            if (user == null) return SignInScreen(auth: _auth);
            if (!user.emailVerified) return VerifyEmailScreen(auth: _auth, email: user.email ?? 'your email');
            return HomeScreen(auth: _auth);
          },
        ),
      );
}

class _AuthUnavailableScreen extends StatelessWidget {
  const _AuthUnavailableScreen();

  @override
  Widget build(BuildContext context) => const Scaffold(
        body: SafeArea(
          child: Center(
            child: Padding(
              padding: EdgeInsets.all(24),
              child: Text('Signova could not load your account session. Check your connection and restart the app.', textAlign: TextAlign.center),
            ),
          ),
        ),
      );
}
