import { BarChart3, BookOpen, CircleDollarSign, Clapperboard, CreditCard, FileChartColumn, Headphones, LayoutDashboard, MessageSquare, Orbit, Settings2, ShieldCheck, ShoppingBag, Sparkles, Users, Wallet, Bell } from "lucide-react";
const icons = {dashboard:LayoutDashboard,finance:CircleDollarSign,customers:Users,support:Headphones,feedback:MessageSquare,astrologers:ShieldCheck,consultations:MessageSquare,wallet:Wallet,payments:CreditCard,subscriptions:BookOpen,notifications:Bell,analytics:BarChart3,reports:FileChartColumn,kundli:Orbit,marketplace:ShoppingBag,settings:Settings2,videos:Clapperboard};
export function AdminIcon({name,size=20}: {name:string;size?:number}) {
  const Icon = icons[name as keyof typeof icons] ?? Sparkles;
  return <Icon size={size} strokeWidth={1.7} aria-hidden="true"/>;
}
