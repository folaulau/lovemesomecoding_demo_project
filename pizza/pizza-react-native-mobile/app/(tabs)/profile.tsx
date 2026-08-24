import { RequireAuth } from '@/features/auth/components/RequireAuth';
import { ProfileScreen } from '@/features/profile/screens/ProfileScreen';

export default function ProfileRoute() {
  return (
    <RequireAuth>
      <ProfileScreen />
    </RequireAuth>
  );
}
