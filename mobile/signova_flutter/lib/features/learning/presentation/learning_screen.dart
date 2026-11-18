import 'package:flutter/material.dart';

class LearningScreen extends StatefulWidget {
  const LearningScreen({super.key});

  @override
  State<LearningScreen> createState() => _LearningScreenState();
}

class _LearningScreenState extends State<LearningScreen> {
  static const _topics = [
    _LessonTopic(
      title: 'Greetings',
      description: 'Introductions and everyday greetings',
      icon: Icons.waving_hand_outlined,
    ),
    _LessonTopic(
      title: 'Everyday needs',
      description: 'Useful signs for common situations',
      icon: Icons.chat_bubble_outline,
    ),
    _LessonTopic(
      title: 'Numbers',
      description: 'A starter path for number signs',
      icon: Icons.dialpad_outlined,
    ),
    _LessonTopic(
      title: 'People and family',
      description: 'Words for people close to you',
      icon: Icons.people_outline,
    ),
  ];

  final _search = TextEditingController();
  String _language = 'ISL';
  String _query = '';

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final topics = _topics
        .where((topic) => '${topic.title} ${topic.description}'.toLowerCase().contains(_query.toLowerCase()))
        .toList();

    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 12, 18, 28),
      children: [
        Text('Your learning space', style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        Text(
          'Explore a sign language and build your vocabulary one topic at a time.',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: const Color(0xff60738e)),
        ),
        const SizedBox(height: 20),
        Card(
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('CHOOSE A SIGN LANGUAGE', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 1.1, color: Color(0xff526b89))),
                const SizedBox(height: 12),
                SegmentedButton<String>(
                  segments: const [
                    ButtonSegment(value: 'ISL', label: Text('ISL'), icon: Icon(Icons.sign_language)),
                    ButtonSegment(value: 'ASL', label: Text('ASL'), icon: Icon(Icons.sign_language)),
                  ],
                  selected: {_language},
                  onSelectionChanged: (selection) => setState(() => _language = selection.first),
                ),
                const SizedBox(height: 14),
                Row(
                  children: [
                    const Icon(Icons.info_outline, size: 18, color: Color(0xff147de1)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Lesson clips and grammar notes are still being reviewed for $_language.',
                        style: const TextStyle(fontSize: 13, color: Color(0xff526b89)),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 22),
        TextField(
          controller: _search,
          onChanged: (value) => setState(() => _query = value.trim()),
          textInputAction: TextInputAction.search,
          decoration: InputDecoration(
            hintText: 'Search learning topics',
            prefixIcon: const Icon(Icons.search),
            suffixIcon: _query.isEmpty
                ? null
                : IconButton(
                    tooltip: 'Clear search',
                    onPressed: () {
                      _search.clear();
                      setState(() => _query = '');
                    },
                    icon: const Icon(Icons.close),
                  ),
          ),
        ),
        const SizedBox(height: 22),
        Row(
          children: [
            Expanded(child: Text('Starter topics', style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800))),
            Text('${topics.length} topics', style: Theme.of(context).textTheme.labelLarge?.copyWith(color: const Color(0xff60738e))),
          ],
        ),
        const SizedBox(height: 12),
        if (topics.isEmpty)
          const Card(
            child: Padding(
              padding: EdgeInsets.all(22),
              child: Text('No topics match that search. Try a different word.'),
            ),
          )
        else
          for (final topic in topics) ...[
            _TopicCard(
              topic: topic,
              onTap: () => Navigator.of(context).push(MaterialPageRoute<void>(
                builder: (_) => _TopicDetailScreen(language: _language, topic: topic),
              )),
            ),
            const SizedBox(height: 10),
          ],
      ],
    );
  }
}

class _LessonTopic {
  const _LessonTopic({required this.title, required this.description, required this.icon});

  final String title;
  final String description;
  final IconData icon;
}

class _TopicCard extends StatelessWidget {
  const _TopicCard({required this.topic, required this.onTap});

  final _LessonTopic topic;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Card(
        child: ListTile(
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          leading: CircleAvatar(
            backgroundColor: const Color(0xffe8f3ff),
            foregroundColor: const Color(0xff147de1),
            child: Icon(topic.icon),
          ),
          title: Text(topic.title, style: const TextStyle(fontWeight: FontWeight.w700)),
          subtitle: Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(topic.description),
          ),
          trailing: const Icon(Icons.arrow_forward_ios, size: 16),
          onTap: onTap,
        ),
      );
}

class _TopicDetailScreen extends StatelessWidget {
  const _TopicDetailScreen({required this.language, required this.topic});

  final String language;
  final _LessonTopic topic;

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: Text(topic.title)),
        body: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Container(
              height: 210,
              decoration: BoxDecoration(
                color: const Color(0xffe8f3ff),
                borderRadius: BorderRadius.circular(24),
              ),
              child: Icon(topic.icon, size: 72, color: const Color(0xff147de1)),
            ),
            const SizedBox(height: 18),
            Text('$language · STARTER TOPIC', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w800, letterSpacing: 1.1, color: Color(0xff526b89))),
            const SizedBox(height: 8),
            Text(topic.title, style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            Text(topic.description, style: Theme.of(context).textTheme.bodyLarge),
            const SizedBox(height: 20),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(18),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.pending_outlined, color: Color(0xffa05a00)),
                        SizedBox(width: 10),
                        Expanded(child: Text('Learning content is being prepared', style: TextStyle(fontWeight: FontWeight.w800))),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Text(
                      'We will add this lesson after its sign demonstration and language notes are reviewed by fluent $language users. This preview does not yet teach a verified sign.',
                      style: const TextStyle(color: Color(0xff526b89), height: 1.45),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 18),
            OutlinedButton.icon(
              onPressed: () => Navigator.of(context).pop(),
              icon: const Icon(Icons.arrow_back),
              label: const Text('Back to topics'),
            ),
          ],
        ),
      );
}
