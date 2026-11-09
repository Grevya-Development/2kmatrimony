import { router } from 'expo-router';
import { EmptyState, Screen } from '@/components/ui';

export default function NotFound() {
  return (
    <Screen>
      <EmptyState title="Page not found" description="This link may be out of date." action={{ label: 'Go home', onPress: () => router.replace('/') }} />
    </Screen>
  );
}
