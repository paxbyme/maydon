import 'package:flutter/material.dart';

class MaydonDestination {
  const MaydonDestination(this.label, this.icon);
  final String label;
  final IconData icon;
}

class MaydonShell extends StatelessWidget {
  const MaydonShell({
    super.key,
    required this.title,
    required this.destinations,
    required this.selectedIndex,
    required this.onSelect,
    required this.child,
    this.actions,
  });
  final String title;
  final List<MaydonDestination> destinations;
  final int selectedIndex;
  final ValueChanged<int> onSelect;
  final Widget child;
  final List<Widget>? actions;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final wide = constraints.maxWidth >= 760;
      final expanded = constraints.maxWidth >= 1180;
      return Scaffold(
        appBar: AppBar(title: Text(title), actions: actions),
        body: SafeArea(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (wide) ...[
                NavigationRail(
                  extended: expanded,
                  labelType: expanded
                      ? NavigationRailLabelType.none
                      : NavigationRailLabelType.all,
                  selectedIndex: selectedIndex,
                  onDestinationSelected: onSelect,
                  destinations: [
                    for (final item in destinations)
                      NavigationRailDestination(
                        icon: Icon(item.icon),
                        label: Text(item.label),
                      ),
                  ],
                ),
                const VerticalDivider(width: 1),
              ],
              Expanded(
                child: Align(
                  alignment: Alignment.topCenter,
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 1200),
                    child: child,
                  ),
                ),
              ),
            ],
          ),
        ),
        bottomNavigationBar: wide
            ? null
            : NavigationBar(
                selectedIndex: selectedIndex,
                onDestinationSelected: onSelect,
                labelBehavior:
                    NavigationDestinationLabelBehavior.onlyShowSelected,
                destinations: [
                  for (final item in destinations)
                    NavigationDestination(
                      icon: Icon(item.icon),
                      label: item.label,
                    ),
                ],
              ),
      );
    },
  );
}

class MaydonEmptyState extends StatelessWidget {
  const MaydonEmptyState({
    super.key,
    required this.icon,
    required this.title,
    required this.message,
  });
  final IconData icon;
  final String title;
  final String message;
  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ExcludeSemantics(child: Icon(icon, size: 40)),
          const SizedBox(height: 24),
          Semantics(
            header: true,
            child: Text(
              title,
              style: Theme.of(context).textTheme.headlineSmall,
            ),
          ),
          const SizedBox(height: 12),
          Text(message),
        ],
      ),
    ),
  );
}
