import Link from "next/link";
import type { ReactNode } from "react";
import { currentUser } from "@/lib/api/server";

/**
 * "Sign in to Seller Hub" for every visitor: sellers go straight in; anyone
 * else goes to the seller sign in, where a signed-in shopper can switch to
 * their seller number. (Linking to /seller alone would send a shopper back
 * to registration.)
 */
export async function SellerSignIn({ className, children }: { className?: string; children: ReactNode }) {
  const user = await currentUser();
  return (
    <Link href={user?.sellers.length ? "/seller" : "/login?next=%2Fseller&as=seller"} className={className}>
      {children}
    </Link>
  );
}
