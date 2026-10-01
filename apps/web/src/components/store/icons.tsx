import {
  BookOpen,
  CircleX,
  Crown,
  CreditCard,
  Dumbbell,
  Laptop,
  Package,
  PackageCheck,
  Puzzle,
  Refrigerator,
  Shirt,
  ShieldCheck,
  ShoppingBasket,
  Smartphone,
  Sofa,
  Sparkles,
  Tag,
  Truck,
  Undo2,
  UserRound,
  Wallet,
  Warehouse,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

/**
 * Icons referenced by name in mock data (categories, help topics). Server and
 * client components both render <NamedIcon name="Sofa" /> so no icon
 * component ever crosses the server/client boundary.
 */
const ICONS: Record<string, LucideIcon> = {
  Smartphone,
  Laptop,
  Shirt,
  Sofa,
  Refrigerator,
  Sparkles,
  ShoppingBasket,
  BookOpen,
  Dumbbell,
  Puzzle,
  Package,
  Undo2,
  XCircle: CircleX,
  CreditCard,
  Wallet,
  Crown,
  ShieldCheck,
  UserRound,
  Warehouse,
  Truck,
  PackageCheck,
};

export function NamedIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = ICONS[name] ?? Tag;
  return <Icon aria-hidden="true" strokeWidth={1.8} {...props} />;
}
