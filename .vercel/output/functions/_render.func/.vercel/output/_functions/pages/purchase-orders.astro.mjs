import { a as createComponent, r as renderTemplate, l as renderComponent, f as createAstro, m as maybeRenderHead } from '../chunks/vendor_LCkWoqkp.mjs';
export { g as renderers } from '../chunks/vendor_LCkWoqkp.mjs';
import 'kleur/colors';
import { $ as $$Layout } from '../chunks/Layout_OYn8kqkt.mjs';

const $$Astro = createAstro();
const $$PurchaseOrders = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$PurchaseOrders;
  const user = Astro2.locals.user;
  const profile = user?.profile;
  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return Astro2.redirect("/dashboard");
  }
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Purchase Orders - KSA CRM" }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="max-w-7xl mx-auto"> <h1 class="text-2xl font-bold text-white mb-6">Purchase Orders</h1> <!-- Filters --> <div class="bg-gray-800 rounded-lg p-4 mb-6 flex gap-4 items-end"> <div> <label class="block text-sm text-gray-400 mb-1">Company</label> <select id="companyFilter" class="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"> <option value="">All Companies</option> </select> </div> <div> <label class="block text-sm text-gray-400 mb-1">Status</label> <select id="statusFilter" class="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"> <option value="">All</option> <option value="draft">Draft</option> <option value="sent">Sent</option> <option value="confirmed">Confirmed</option> <option value="partially_delivered">Partially Delivered</option> <option value="delivered">Delivered</option> <option value="cancelled">Cancelled</option> </select> </div> </div> <!-- Stats --> <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6"> <div class="bg-gray-800 rounded-lg p-4 border border-gray-700"> <p class="text-gray-400 text-sm">Total POs</p> <p class="text-2xl font-bold text-white" id="totalPOs">-</p> </div> <div class="bg-gray-800 rounded-lg p-4 border border-gray-700"> <p class="text-gray-400 text-sm">Total Value</p> <p class="text-2xl font-bold text-green-400" id="totalValue">-</p> </div> <div class="bg-gray-800 rounded-lg p-4 border border-gray-700"> <p class="text-gray-400 text-sm">Pending Delivery</p> <p class="text-2xl font-bold text-yellow-400" id="pendingDelivery">-</p> </div> <div class="bg-gray-800 rounded-lg p-4 border border-gray-700"> <p class="text-gray-400 text-sm">Fully Delivered</p> <p class="text-2xl font-bold text-blue-400" id="fullyDelivered">-</p> </div> </div> <!-- PO Table --> <div class="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden"> <div class="overflow-x-auto"> <table class="w-full text-sm"> <thead class="bg-gray-700/50"> <tr> <th class="px-4 py-3 text-left text-gray-300">PO Number</th> <th class="px-4 py-3 text-left text-gray-300">Company</th> <th class="px-4 py-3 text-right text-gray-300">Items</th> <th class="px-4 py-3 text-right text-gray-300">Total Amount</th> <th class="px-4 py-3 text-center text-gray-300">Status</th> <th class="px-4 py-3 text-left text-gray-300">Created</th> <th class="px-4 py-3 text-center text-gray-300">Actions</th> </tr> </thead> <tbody id="poTableBody"> <tr><td colspan="7" class="px-4 py-8 text-center text-gray-400">Loading...</td></tr> </tbody> </table> </div> </div> </div> ` })} `;
}, "/home/ahmed/Documents/ksa_v3/src/pages/purchase-orders.astro", void 0);

const $$file = "/home/ahmed/Documents/ksa_v3/src/pages/purchase-orders.astro";
const $$url = "/purchase-orders";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$PurchaseOrders,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
