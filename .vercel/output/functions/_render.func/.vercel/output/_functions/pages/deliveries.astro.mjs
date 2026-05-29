import { a as createComponent, r as renderTemplate, l as renderComponent, f as createAstro, m as maybeRenderHead } from '../chunks/vendor_LCkWoqkp.mjs';
export { g as renderers } from '../chunks/vendor_LCkWoqkp.mjs';
import 'kleur/colors';
import { $ as $$Layout } from '../chunks/Layout_OYn8kqkt.mjs';

const $$Astro = createAstro();
const $$Deliveries = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Deliveries;
  const user = Astro2.locals.user;
  const profile = user?.profile;
  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return Astro2.redirect("/dashboard");
  }
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Delivery Tracking - KSA CRM" }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="max-w-7xl mx-auto"> <h1 class="text-2xl font-bold text-white mb-6">Delivery Tracking</h1> <!-- Filters --> <div class="bg-gray-800 rounded-lg p-4 mb-6 flex gap-4 items-end"> <div> <label class="block text-sm text-gray-400 mb-1">Company</label> <select id="companyFilter" class="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"> <option value="">All Companies</option> </select> </div> <div> <label class="block text-sm text-gray-400 mb-1">Status</label> <select id="statusFilter" class="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"> <option value="">All</option> <option value="sent">Sent</option> <option value="confirmed">Confirmed</option> <option value="partially_delivered">Partially Delivered</option> <option value="delivered">Delivered</option> </select> </div> </div> <!-- PO List --> <div id="poList" class="space-y-4"> <div class="text-center text-gray-400 py-8">Loading purchase orders...</div> </div> </div> ` })} `;
}, "/home/ahmed/Documents/ksa_v3/src/pages/deliveries.astro", void 0);

const $$file = "/home/ahmed/Documents/ksa_v3/src/pages/deliveries.astro";
const $$url = "/deliveries";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Deliveries,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
