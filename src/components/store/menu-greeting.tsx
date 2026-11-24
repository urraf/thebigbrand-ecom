"use client";
import Link from "next/link";
import { useStore } from "@/components/cart/cart-context";

/** Drawer heading: "Hello, Priya" when signed in, else a Sign in link. */
export function MenuGreeting() {
  const { user, ready } = useStore();
  if (ready && !user) {
    return (
      <b>
        <Link href="/login" prefetch={false}>
          Hello, sign in
        </Link>
      </b>
    );
  }
  return <b>{user ? `Hello, ${user.firstName}` : "Hello"}</b>;
}
