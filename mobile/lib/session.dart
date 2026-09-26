import "dart:async";

import "package:flutter/foundation.dart";
import "package:supabase_flutter/supabase_flutter.dart";

import "models.dart";
import "tally_api.dart";

class SessionController extends ChangeNotifier {
  SessionController(this.api) {
    _authSub = api.authChanges.listen((state) {
      unawaited(_sync(state.session?.user));
    });
    unawaited(_sync(api.user));
  }

  final TallyApi api;
  StreamSubscription<AuthState>? _authSub;

  bool ready = false;
  User? user;
  Profile? profile;
  String? error;

  bool get isStaff => profile?.isStaff == true;

  Future<void> _sync(User? nextUser) async {
    user = nextUser;
    error = null;
    if (nextUser == null) {
      profile = null;
      ready = true;
      notifyListeners();
      return;
    }
    try {
      final loaded = await api.loadProfile(nextUser.id);
      if (loaded == null || !loaded.isStaff) {
        await api.signOut();
        profile = null;
        user = null;
        error = loaded == null
            ? "No profile found for this account."
            : "This app is for Counting Supervisors only.";
        ready = true;
        notifyListeners();
        return;
      }
      profile = loaded;
    } catch (caught) {
      error = caught.toString();
      profile = null;
    }
    ready = true;
    notifyListeners();
  }

  Future<String?> signIn(String email, String password) async {
    error = null;
    notifyListeners();
    try {
      await api.signIn(email.trim(), password);
      return null;
    } on AuthException catch (caught) {
      error = caught.message;
      notifyListeners();
      return error;
    } catch (caught) {
      error = caught.toString();
      notifyListeners();
      return error;
    }
  }

  Future<void> signOut() async {
    await api.signOut();
  }

  @override
  void dispose() {
    unawaited(_authSub?.cancel());
    super.dispose();
  }
}
