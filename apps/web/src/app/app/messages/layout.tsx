import { MessagesLayout } from '@/components/messaging/messages-layout';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <MessagesLayout>{children}</MessagesLayout>;
}
