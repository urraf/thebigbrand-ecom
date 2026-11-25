import { Suspense } from "react";
import { AdInspector } from "@/components/ads";
import { CartProvider } from "@/components/cart/cart-context";
import { AddedFlyout } from "@/components/cart/added-flyout";
import { ChromeClient } from "@/components/store/chrome-client";
import { Footer } from "@/components/store/footer";
import { Header } from "@/components/store/header";
import { MenuDrawer } from "@/components/store/menu-drawer";
import { StoreHydrator } from "@/components/store/session-slots";
import { TabBar } from "@/components/store/tab-bar";
import { NavProgress } from "@/components/ui/nav-progress";
import { Toaster } from "@/components/ui/toast";
import "@/styles/store/ui.css";
import "@/styles/store/store.css";

/**
 * Store chrome for every shopper-facing page: header + sub-nav + mobile location bar, <main>, footer,
 * mobile tab bar, All-categories drawer, toasts, the Added-to-cart flyout and the ad-slot inspector.
 * The whole shell is static (prerendered); per-user bits stream in behind <Suspense>.
 */
export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <Suspense fallback={null}>
        <NavProgress />
      </Suspense>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header id="hdr">
        <Header />
      </header>
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <footer id="ftr">
        <Footer />
      </footer>
      <nav id="tabbar" aria-label="App navigation">
        <TabBar />
      </nav>
      <div className="scrim" data-chrome="menu-close" aria-hidden="true" />
      <MenuDrawer />
      <AddedFlyout />
      <Toaster />
      <AdInspector />
      <ChromeClient />
      <Suspense fallback={null}>
        <StoreHydrator />
      </Suspense>
    </CartProvider>
  );
}
