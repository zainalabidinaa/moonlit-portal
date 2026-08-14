import { useAuth } from '../../context/AuthContext';
import { ProfileEditor } from './ProfileEditor';

/**
 * Blocks every authenticated page behind a mandatory "create your profile"
 * step for any account with zero profiles — mounted in AppShell so it applies
 * regardless of which page the user lands on after signing in or signing up.
 *
 * This used to be impossible to reach: SignupPage inserted a profile row
 * immediately after account creation, so an account was never actually
 * profile-less by the time anyone saw a page. Now that insert is gone, "zero
 * profiles" is a real, persistent state — derived straight from the database,
 * so it survives closing the tab, signing out and back in, or switching
 * devices entirely. It also means iOS and macOS need no changes of their own:
 * their existing "Add Profile" empty-state (ProfilePickerScreen /
 * ProfileSelectionScreen) already covers this — it just never used to be
 * reachable because a profile always already existed.
 */
export function FirstProfileGate() {
  const { user, profiles, loading, refreshProfiles } = useAuth();

  if (loading || !user || profiles.length > 0) return null;

  return (
    <ProfileEditor
      profile={null}
      onClose={() => {}}
      onSaved={refreshProfiles}
      userId={user.id}
      nextIndex={0}
      forceCreate
    />
  );
}
