import { a as createComponent, r as renderTemplate, l as renderComponent, f as createAstro, m as maybeRenderHead } from '../chunks/vendor_LCkWoqkp.mjs';
export { g as renderers } from '../chunks/vendor_LCkWoqkp.mjs';
import 'kleur/colors';
import { $ as $$Layout } from '../chunks/Layout_OYn8kqkt.mjs';

const $$Astro = createAstro();
const $$Analytics = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Analytics;
  const user = Astro2.locals.user;
  const profile = user?.profile;
  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return Astro2.redirect("/dashboard");
  }
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Analytics - KSA CRM" }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="max-w-7xl mx-auto"> <h1 class="text-2xl font-bold text-white mb-6">Business Analytics</h1> <!-- KPI Cards --> <div class="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6"> <div class="bg-gray-800 rounded-lg p-4 border border-gray-700"> <p class="text-gray-400 text-xs uppercase">Total Revenue</p> <p class="text-xl font-bold text-white mt-1" id="totalRevenue">-</p> </div> <div class="bg-gray-800 rounded-lg p-4 border border-gray-700"> <p class="text-gray-400 text-xs uppercase">Total Orders</p> <p class="text-xl font-bold text-white mt-1" id="totalOrders">-</p> </div> <div class="bg-gray-800 rounded-lg p-4 border border-gray-700"> <p class="text-gray-400 text-xs uppercase">Active Companies</p> <p class="text-xl font-bold text-white mt-1" id="activeCompanies">-</p> </div> <div class="bg-gray-800 rounded-lg p-4 border border-gray-700"> <p class="text-gray-400 text-xs uppercase">Avg Availability Rate</p> <p class="text-xl font-bold text-green-400 mt-1" id="avgAvailRate">-</p> </div> <div class="bg-gray-800 rounded-lg p-4 border border-gray-700"> <p class="text-gray-400 text-xs uppercase">Delivery Rate</p> <p class="text-xl font-bold text-blue-400 mt-1" id="deliveryRate">-</p> </div> </div> <!-- Charts Row --> <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6"> <div class="bg-gray-800 rounded-lg p-5 border border-gray-700"> <h3 class="text-white font-semibold mb-4">Orders by Company</h3> <canvas id="companyChart" height="250"></canvas> </div> <div class="bg-gray-800 rounded-lg p-5 border border-gray-700"> <h3 class="text-white font-semibold mb-4">Profit/Loss by Batch</h3> <canvas id="profitChart" height="250"></canvas> </div> </div> <!-- Company Performance Table --> <div class="bg-gray-800 rounded-lg border border-gray-700"> <div class="p-4 border-b border-gray-700"> <h2 class="text-lg font-semibold text-white">Company Performance</h2> </div> <div class="overflow-x-auto"> <table class="w-full text-sm"> <thead class="bg-gray-700/50"> <tr> <th class="px-4 py-3 text-left text-gray-300">Company</th> <th class="px-4 py-3 text-right text-gray-300">Products</th> <th class="px-4 py-3 text-right text-gray-300">Total PO Value</th> <th class="px-4 py-3 text-right text-gray-300">Availability Rate</th> <th class="px-4 py-3 text-right text-gray-300">Delivery Rate</th> <th class="px-4 py-3 text-center text-gray-300">Status</th> </tr> </thead> <tbody id="performanceTable"> <tr><td colspan="6" class="px-4 py-6 text-center text-gray-400">Loading...</td></tr> </tbody> </table> </div> </div> </div> ` })} `;
}, "/home/ahmed/Documents/ksa_v3/src/pages/analytics.astro", void 0);

const $$file = "/home/ahmed/Documents/ksa_v3/src/pages/analytics.astro";
const $$url = "/analytics";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Analytics,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
