import {
  Bell, Bookmark, ChartLine, Compass, Cpu, Crown, Dna, FileText, Flag, Gem, GitCompare, Heart, Home, IdCard,
  LayoutDashboard, LifeBuoy, MessageCircleHeart, MessagesSquare, ReceiptIndianRupee, ScrollText, Settings, ShieldCheck,
  SlidersHorizontal, Sparkles, User, Users, type LucideIcon,
} from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  bell: Bell, bookmark: Bookmark, 'chart-line': ChartLine, compass: Compass, cpu: Cpu, crown: Crown, dna: Dna,
  'file-text': FileText, flag: Flag, gem: Gem, 'git-compare': GitCompare, heart: Heart, home: Home, 'id-card': IdCard,
  'layout-dashboard': LayoutDashboard, 'life-buoy': LifeBuoy, 'message-circle-heart': MessageCircleHeart,
  'messages-square': MessagesSquare, 'receipt-indian-rupee': ReceiptIndianRupee, 'scroll-text': ScrollText,
  settings: Settings, 'shield-check': ShieldCheck, 'sliders-horizontal': SlidersHorizontal, sparkles: Sparkles, user: User, users: Users,
};

export function NavIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Sparkles;
  return <Icon className={className} aria-hidden />;
}
