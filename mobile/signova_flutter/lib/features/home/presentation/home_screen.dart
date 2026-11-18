import 'package:flutter/material.dart';

import '../../auth/data/auth_repository.dart';
import '../../calls/presentation/calls_screen.dart';
import '../../learning/presentation/learning_screen.dart';
import '../../translation/presentation/translation_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({required this.auth, super.key});

  final AuthRepository auth;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final pages = [TranslationScreen(active: _tab == 0), const LearningScreen(), const CallsScreen()];
    return Scaffold(
      appBar: AppBar(
        title: const Text('Signova'),
        actions: [IconButton(tooltip: 'Sign out', onPressed: widget.auth.signOut, icon: const Icon(Icons.logout))],
      ),
      body: IndexedStack(index: _tab, children: pages),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (index) => setState(() => _tab = index),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.sign_language), label: 'Translate'),
          NavigationDestination(icon: Icon(Icons.menu_book_outlined), label: 'Learn'),
          NavigationDestination(icon: Icon(Icons.call_outlined), label: 'Calls'),
        ],
      ),
    );
  }
}
