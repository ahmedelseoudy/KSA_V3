import { a as createComponent, r as renderTemplate, l as renderComponent, f as createAstro, m as maybeRenderHead } from '../chunks/vendor_LCkWoqkp.mjs';
export { g as renderers } from '../chunks/vendor_LCkWoqkp.mjs';
import 'kleur/colors';
import { $ as $$Layout } from '../chunks/Layout_OYn8kqkt.mjs';

const $$Astro = createAstro();
const $$Dashboard = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Dashboard;
  const user = Astro2.locals.user;
  const profile = user?.profile;
  if (profile?.role === "company") {
    return Astro2.redirect("/portal");
  }
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Dashboard - KSA CRM" }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="max-w-7xl mx-auto"> <div class="mb-8"> <h1 class="text-2xl font-bold text-white">Dashboard</h1> <p class="text-gray-400 mt-1">Welcome back, ${user?.email}</p> </div> <!-- Quick Stats --> <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8" id="statsGrid"> <div class="bg-gray-800 rounded-lg p-5 border border-gray-700"> <p class="text-gray-400 text-sm">Order Batches</p> <p class="text-3xl font-bold text-white mt-1" id="statBatches">-</p> </div> <div class="bg-gray-800 rounded-lg p-5 border border-gray-700"> <p class="text-gray-400 text-sm">Companies</p> <p class="text-3xl font-bold text-blue-400 mt-1" id="statCompanies">-</p> </div> <div class="bg-gray-800 rounded-lg p-5 border border-gray-700"> <p class="text-gray-400 text-sm">Products</p> <p class="text-3xl font-bold text-purple-400 mt-1" id="statProducts">-</p> </div> <div class="bg-gray-800 rounded-lg p-5 border border-gray-700"> <p class="text-gray-400 text-sm">Active POs</p> <p class="text-3xl font-bold text-green-400 mt-1" id="statPOs">-</p> </div> </div> <!-- Quick Actions --> <h2 class="text-lg font-semibold text-white mb-4">Quick Actions</h2> <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8"> <a href="/products" class="bg-gray-800 rounded-lg p-5 border border-gray-700 hover:border-purple-500/50 transition-colors group"> <span class="text-2xl mb-2 block">📦</span> <h3 class="text-white font-semibold group-hover:text-purple-400 transition-colors">Products Database</h3> <p class="text-gray-400 text-sm mt-1">Upload and manage your product catalog</p> </a> <a href="/orders" class="bg-gray-800 rounded-lg p-5 border border-gray-700 hover:border-blue-500/50 transition-colors group"> <span class="text-2xl mb-2 block">📋</span> <h3 class="text-white font-semibold group-hover:text-blue-400 transition-colors">Order Batches</h3> <p class="text-gray-400 text-sm mt-1">Create and manage order batches</p> </a> <a href="/" class="bg-gray-800 rounded-lg p-5 border border-gray-700 hover:border-green-500/50 transition-colors group"> <span class="text-2xl mb-2 block">🔄</span> <h3 class="text-white font-semibold group-hover:text-green-400 transition-colors">Process Orders</h3> <p class="text-gray-400 text-sm mt-1">Upload and process new order files</p> </a> <a href="/availability" class="bg-gray-800 rounded-lg p-5 border border-gray-700 hover:border-yellow-500/50 transition-colors group"> <span class="text-2xl mb-2 block">✅</span> <h3 class="text-white font-semibold group-hover:text-yellow-400 transition-colors">Availability</h3> <p class="text-gray-400 text-sm mt-1">Track company availability responses</p> </a> <a href="/deliveries" class="bg-gray-800 rounded-lg p-5 border border-gray-700 hover:border-orange-500/50 transition-colors group"> <span class="text-2xl mb-2 block">🚚</span> <h3 class="text-white font-semibold group-hover:text-orange-400 transition-colors">Deliveries</h3> <p class="text-gray-400 text-sm mt-1">Track delivery status per PO</p> </a> <a href="/analytics" class="bg-gray-800 rounded-lg p-5 border border-gray-700 hover:border-pink-500/50 transition-colors group"> <span class="text-2xl mb-2 block">📊</span> <h3 class="text-white font-semibold group-hover:text-pink-400 transition-colors">Analytics</h3> <p class="text-gray-400 text-sm mt-1">Business insights and performance</p> </a> </div> <!-- Recent Activity --> <div class="bg-gray-800 rounded-lg p-5 border border-gray-700"> <h2 class="text-lg font-semibold text-white mb-4">Recent Order Batches</h2> <div id="recentBatches" class="space-y-3"> <p class="text-gray-400 text-sm">Loading...</p> </div> </div> </div> ` })} `;
}, "/home/ahmed/Documents/ksa_v3/src/pages/dashboard.astro", void 0);

const $$file = "/home/ahmed/Documents/ksa_v3/src/pages/dashboard.astro";
const $$url = "/dashboard";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Dashboard,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
