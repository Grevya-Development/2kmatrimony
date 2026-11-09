import { ActiveProfileGate } from '@/components/shell/profile-gate';
import { MessagesLayout } from '@/components/messaging/messages-layout';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <ActiveProfileGate><MessagesLayout>{children}</MessagesLayout></ActiveProfileGate>;
}
