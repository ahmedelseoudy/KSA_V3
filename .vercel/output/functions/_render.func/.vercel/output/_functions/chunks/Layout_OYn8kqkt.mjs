import { a as createComponent, r as renderTemplate, m as maybeRenderHead, b as addAttribute, f as createAstro, d as renderHead, l as renderComponent, e as renderSlot } from './vendor_LCkWoqkp.mjs';
import 'kleur/colors';
import 'clsx';
/* empty css                         */

const NAV_ITEMS = [
  {
    path: "/dashboard",
    label: "Dashboard",
    icon: "📈",
    roles: ["user", "admin", "super_admin"]
  },
  {
    path: "/products",
    label: "Products Database",
    icon: "📦",
    roles: ["admin", "super_admin"]
  },
  {
    path: "/companies",
    label: "Companies",
    icon: "🏢",
    roles: ["admin", "super_admin"]
  },
  {
    path: "/orders",
    label: "Order Batches",
    icon: "📋",
    roles: ["admin", "super_admin"]
  },
  {
    path: "/availability",
    label: "Availability",
    icon: "✅",
    roles: ["admin", "super_admin"]
  },
  {
    path: "/purchase-orders",
    label: "Purchase Orders",
    icon: "📝",
    roles: ["admin", "super_admin"]
  },
  {
    path: "/deliveries",
    label: "Deliveries",
    icon: "🚚",
    roles: ["admin", "super_admin"]
  },
  {
    path: "/analytics",
    label: "Analytics",
    icon: "📊",
    roles: ["admin", "super_admin"]
  },
  {
    path: "/admin",
    label: "Admin Panel",
    icon: "⚙️",
    roles: ["admin", "super_admin"]
  },
  {
    path: "/portal",
    label: "My Dashboard",
    icon: "🏠",
    roles: ["company"]
  },
  {
    path: "/portal/availability",
    label: "Availability Requests",
    icon: "✅",
    roles: ["company"]
  },
  {
    path: "/portal/purchase-orders",
    label: "Purchase Orders",
    icon: "📝",
    roles: ["company"]
  }
];

const $$Astro$1 = createAstro();
const $$Navigation = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro$1, $$props, $$slots);
  Astro2.self = $$Navigation;
  const user = Astro2.locals.user;
  const userRole = user?.profile?.role || "user";
  const allowedNavItems = NAV_ITEMS.filter(
    (item) => item.roles.includes(userRole)
  );
  return renderTemplate`${maybeRenderHead()}<div class="navigation-wrapper" data-astro-cid-pux6a34n> <nav id="mainNav" class="nav-menu bg-gray-800 shadow-lg" data-astro-cid-pux6a34n> <div class="nav-content" data-astro-cid-pux6a34n> <ul class="py-2" data-astro-cid-pux6a34n> ${allowedNavItems.map((item) => renderTemplate`<li data-astro-cid-pux6a34n> <a${addAttribute(item.path, "href")}${addAttribute(`flex items-center px-4 py-2 text-sm relative group ${Astro2.url.pathname === item.path ? "bg-purple-600 text-white" : "text-gray-300 hover:bg-gray-700 hover:text-white"}`, "class")} data-astro-cid-pux6a34n> <span class="mr-3" data-astro-cid-pux6a34n>${item.icon}</span> ${item.label} ${item.path === "/po" && renderTemplate`<span class="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-gray-700 text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap" data-astro-cid-pux6a34n>
Press Ctrl+M to toggle menu
</span>`} </a> </li>`).filter((item) => item.path !== "/database")} </ul> <!-- Logout button at bottom --> <div class="absolute bottom-4 left-4 right-4" data-astro-cid-pux6a34n> <button id="nav-logout-btn" class="w-full flex items-center px-4 py-2 text-sm text-gray-300 hover:bg-red-600 hover:text-white transition-colors rounded" data-astro-cid-pux6a34n> <span class="mr-3" data-astro-cid-pux6a34n>🚪</span>
Sign Out
</button> </div> </div> </nav> <!-- Mobile toggle button (always visible on mobile) --> <button class="mobile-toggle-btn md:hidden fixed top-4 right-4 z-50 p-2 rounded-full bg-gray-700 text-white hover:bg-gray-600" data-astro-cid-pux6a34n> <svg xmlns="http://www.w3.org/2000/svg" class="toggle-icon h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-astro-cid-pux6a34n> <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" data-astro-cid-pux6a34n></path> </svg> </button> <!-- Desktop toggle button (outside the collapsible area) --> <button id="desktopMenuToggle" class="desktop-toggle-btn hidden md:flex fixed left-4 top-4 z-[100] p-2 rounded-full bg-gray-700 text-white hover:bg-gray-600 transition-all shadow-lg border border-gray-600" aria-label="Toggle Menu" title="Toggle Menu" data-astro-cid-pux6a34n> <svg xmlns="http://www.w3.org/2000/svg" class="toggle-icon h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" data-astro-cid-pux6a34n> <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" data-astro-cid-pux6a34n></path> </svg> </button> </div>   `;
}, "/home/ahmed/Documents/ksa_v3/src/components/Navigation.astro", void 0);

const $$Astro = createAstro();
const $$Layout = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Layout;
  const { title, showNavigation = true } = Astro2.props;
  const user = Astro2.locals.user;
  const shouldShowNav = showNavigation && !!(user && user.profile && user.profile.status === "approved");
  return renderTemplate`<html lang="en" data-astro-cid-sckkx6r4> <head><meta charset="UTF-8"><meta name="description" content="CRM System"><meta name="viewport" content="width=device-width"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><meta name="generator"${addAttribute(Astro2.generator, "content")}><title>${title}</title>${renderHead()}</head> <body class="bg-gray-900 overflow-x-hidden" data-astro-cid-sckkx6r4> ${shouldShowNav ? renderTemplate`<div class="flex min-h-screen" data-astro-cid-sckkx6r4> ${renderComponent($$result, "Navigation", $$Navigation, { "data-astro-cid-sckkx6r4": true })} <main id="mainContent" class="flex-1 transition-all duration-300 ease-in-out p-4" data-astro-cid-sckkx6r4> ${renderSlot($$result, $$slots["default"])} </main> </div>` : renderTemplate`<main class="min-h-screen" data-astro-cid-sckkx6r4> ${renderSlot($$result, $$slots["default"])} </main>`}   </body></html>`;
}, "/home/ahmed/Documents/ksa_v3/src/layouts/Layout.astro", void 0);

export { $$Layout as $ };
