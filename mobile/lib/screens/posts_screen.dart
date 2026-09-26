import "dart:async";

import "package:flutter/material.dart";
import "package:supabase_flutter/supabase_flutter.dart";

import "../models.dart";
import "../session.dart";
import "../tally_api.dart";
import "../theme.dart";
import "../widgets/brand.dart";
import "desk_screen.dart";

class PostsScreen extends StatefulWidget {
  const PostsScreen({super.key, required this.session, required this.api});

  final SessionController session;
  final TallyApi api;

  @override
  State<PostsScreen> createState() => _PostsScreenState();
}

class _PostsScreenState extends State<PostsScreen> {
  Election? _election;
  List<PostSummary> _posts = [];
  bool _loading = true;
  String? _error;
  RealtimeChannel? _channel;

  @override
  void initState() {
    super.initState();
    unawaited(_reload());
    _channel = widget.api.roundsChannel(() {
      if (mounted) unawaited(_reload(silent: true));
    })
      ..subscribe();
  }

  @override
  void dispose() {
    final channel = _channel;
    if (channel != null) {
      unawaited(widget.api.client.removeChannel(channel));
    }
    super.dispose();
  }

  Future<void> _reload({bool silent = false}) async {
    final userId = widget.session.user?.id;
    if (userId == null) return;
    if (!silent) setState(() => _loading = true);
    try {
      final loaded = await widget.api.loadAssignedPosts(userId);
      if (!mounted) return;
      setState(() {
        _election = loaded.election;
        _posts = loaded.posts;
        _error = null;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final name = widget.session.profile?.fullName;
    return Scaffold(
      appBar: AppBar(
        title: const BrandLockup(compact: true),
        actions: [
          IconButton(
            tooltip: "Sign out",
            onPressed: widget.session.signOut,
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _reload,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          children: [
            Text(
              "Counting Supervisor",
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                  ),
            ),
            const SizedBox(height: 4),
            Text(
              [
                if (name != null && name.isNotEmpty) name,
                if (_election != null) "${_election!.name} · state: ${_election!.state}",
                if (_election == null) "No election configured.",
              ].join(" · "),
              style: const TextStyle(color: GeciColors.mutedForeground),
            ),
            const SizedBox(height: 16),
            if (_loading && _posts.isEmpty)
              const Padding(
                padding: EdgeInsets.only(top: 48),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_error != null)
              Notice(text: _error!, tone: BadgeTone.danger)
            else if (_posts.isEmpty)
              const Card(
                child: Padding(
                  padding: EdgeInsets.all(20),
                  child: Text(
                    "You have not been assigned a post yet. Ask the election admin.",
                    style: TextStyle(color: GeciColors.mutedForeground),
                  ),
                ),
              )
            else
              ..._posts.map((summary) => _PostCard(
                    summary: summary,
                    roundSize: _election?.countLimit ?? 0,
                    onOpen: () async {
                      await Navigator.of(context).push(
                        MaterialPageRoute<void>(
                          builder: (_) => DeskScreen(
                            session: widget.session,
                            api: widget.api,
                            postId: summary.post.id,
                          ),
                        ),
                      );
                      if (mounted) unawaited(_reload(silent: true));
                    },
                  )),
          ],
        ),
      ),
    );
  }
}

class _PostCard extends StatelessWidget {
  const _PostCard({
    required this.summary,
    required this.roundSize,
    required this.onOpen,
  });

  final PostSummary summary;
  final int roundSize;
  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final post = summary.post;
    final polled = post.votesPolled;
    final counted = summary.counted;
    final progress = polled > 0 ? (counted / polled).clamp(0, 1).toDouble() : 0.0;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Card(
        child: InkWell(
          onTap: onOpen,
          borderRadius: BorderRadius.circular(14),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        post.name,
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                    ),
                    if (summary.pending != null)
                      const StatusBadge(
                        label: "Awaiting RO",
                        tone: BadgeTone.warning,
                      )
                    else if (summary.rejected != null)
                      const StatusBadge(label: "Rejected", tone: BadgeTone.danger)
                    else if (polled > 0 && counted >= polled)
                      const StatusBadge(label: "Counting done", tone: BadgeTone.success),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  "${post.seats} seat${post.seats > 1 ? "s" : ""}"
                  "${post.seats > 1 ? " · ${post.seats} votes per ballot" : ""}"
                  " · $roundSize ballots per round",
                  style: const TextStyle(
                    color: GeciColors.mutedForeground,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 12),
                ClipRRect(
                  borderRadius: BorderRadius.circular(99),
                  child: LinearProgressIndicator(
                    value: progress,
                    minHeight: 8,
                    backgroundColor: GeciColors.muted,
                    color: GeciColors.primary,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  polled > 0
                      ? "$counted/$polled ballots counted"
                      : "$counted ballots counted",
                  style: const TextStyle(
                    color: GeciColors.mutedForeground,
                    fontSize: 12,
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
