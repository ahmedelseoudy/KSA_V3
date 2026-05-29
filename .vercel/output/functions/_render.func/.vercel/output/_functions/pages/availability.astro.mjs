import { a as createComponent, r as renderTemplate, l as renderComponent, f as createAstro, m as maybeRenderHead } from '../chunks/vendor_LCkWoqkp.mjs';
export { g as renderers } from '../chunks/vendor_LCkWoqkp.mjs';
import 'kleur/colors';
import { $ as $$Layout } from '../chunks/Layout_OYn8kqkt.mjs';

const $$Astro = createAstro();
const $$Availability = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Availability;
  const user = Astro2.locals.user;
  const profile = user?.profile;
  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return Astro2.redirect("/dashboard");
  }
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Availability Overview - KSA CRM" }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="max-w-7xl mx-auto"> <h1 class="text-2xl font-bold text-white mb-6">Availability Overview</h1> <!-- Summary Cards --> <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6" id="summaryCards"> <div class="bg-gray-800 rounded-lg p-4 border border-gray-700"> <p class="text-gray-400 text-sm">Total Requests</p> <p class="text-2xl font-bold text-white" id="totalRequests">-</p> </div> <div class="bg-gray-800 rounded-lg p-4 border border-gray-700"> <p class="text-gray-400 text-sm">Fully Responded</p> <p class="text-2xl font-bold text-green-400" id="fullResponded">-</p> </div> <div class="bg-gray-800 rounded-lg p-4 border border-gray-700"> <p class="text-gray-400 text-sm">Pending</p> <p class="text-2xl font-bold text-yellow-400" id="pending">-</p> </div> <div class="bg-gray-800 rounded-lg p-4 border border-gray-700"> <p class="text-gray-400 text-sm">Unavailable Items</p> <p class="text-2xl font-bold text-red-400" id="unavailableCount">-</p> </div> </div> <!-- Company Breakdown --> <div class="bg-gray-800 rounded-lg border border-gray-700 mb-6"> <div class="p-4 border-b border-gray-700"> <h2 class="text-lg font-semibold text-white">Company Responses</h2> </div> <div class="overflow-x-auto"> <table class="w-full text-sm"> <thead class="bg-gray-700/50"> <tr> <th class="px-4 py-3 text-left text-gray-300">Company</th> <th class="px-4 py-3 text-right text-gray-300">Total Items</th> <th class="px-4 py-3 text-right text-gray-300">Available</th> <th class="px-4 py-3 text-right text-gray-300">Unavailable</th> <th class="px-4 py-3 text-right text-gray-300">Rate</th> <th class="px-4 py-3 text-center text-gray-300">Status</th> </tr> </thead> <tbody id="companyTable"> <tr><td colspan="6" class="px-4 py-6 text-center text-gray-400">Loading...</td></tr> </tbody> </table> </div> </div> <!-- Unavailable Items (cross-company) --> <div class="bg-gray-800 rounded-lg border border-gray-700"> <div class="p-4 border-b border-gray-700 flex justify-between items-center"> <h2 class="text-lg font-semibold text-white">Unavailable Items Summary</h2> <button id="downloadUnavailable" class="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 disabled:opacity-50" disabled>
Download Unavailable
</button> </div> <div class="overflow-x-auto"> <table class="w-full text-sm"> <thead class="bg-gray-700/50"> <tr> <th class="px-4 py-3 text-left text-gray-300">Barcode</th> <th class="px-4 py-3 text-left text-gray-300">Title</th> <th class="px-4 py-3 text-right text-gray-300">Qty</th> <th class="px-4 py-3 text-left text-gray-300">Companies Asked</th> <th class="px-4 py-3 text-left text-gray-300">Unavailable From</th> <th class="px-4 py-3 text-center text-gray-300">All Unavailable?</th> </tr> </thead> <tbody id="unavailableTable"> <tr><td colspan="6" class="px-4 py-6 text-center text-gray-400">Loading...</td></tr> </tbody> </table> </div> </div> </div> ` })} `;
}, "/home/ahmed/Documents/ksa_v3/src/pages/availability.astro", void 0);

const $$file = "/home/ahmed/Documents/ksa_v3/src/pages/availability.astro";
const $$url = "/availability";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Availability,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
