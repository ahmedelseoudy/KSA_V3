import { a as createComponent, r as renderTemplate, l as renderComponent, f as createAstro, m as maybeRenderHead } from '../chunks/vendor_LCkWoqkp.mjs';
export { g as renderers } from '../chunks/vendor_LCkWoqkp.mjs';
import 'kleur/colors';
import { $ as $$Layout } from '../chunks/Layout_OYn8kqkt.mjs';

const $$Astro = createAstro();
const $$Index = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Index;
  const user = Astro2.locals.user;
  const profile = user?.profile;
  if (!profile || profile.role !== "company") {
    return Astro2.redirect("/dashboard");
  }
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Company Portal - KSA CRM" }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="max-w-5xl mx-auto"> <h1 class="text-2xl font-bold text-white mb-6">Welcome to your Portal</h1> <!-- Summary Cards --> <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8"> <div class="bg-gray-800 rounded-lg p-5 border border-gray-700"> <p class="text-gray-400 text-sm">Pending Availability</p> <p class="text-3xl font-bold text-blue-400 mt-1" id="pendingAvail">-</p> <a href="/portal/availability" class="text-xs text-blue-400 hover:text-blue-300 mt-2 block">View requests →</a> </div> <div class="bg-gray-800 rounded-lg p-5 border border-gray-700"> <p class="text-gray-400 text-sm">Active Purchase Orders</p> <p class="text-3xl font-bold text-purple-400 mt-1" id="activePOs">-</p> <a href="/portal/purchase-orders" class="text-xs text-purple-400 hover:text-purple-300 mt-2 block">View orders →</a> </div> <div class="bg-gray-800 rounded-lg p-5 border border-gray-700"> <p class="text-gray-400 text-sm">Total Products</p> <p class="text-3xl font-bold text-green-400 mt-1" id="totalProds">-</p> </div> </div> <!-- Recent Activity --> <div class="bg-gray-800 rounded-lg p-5 border border-gray-700"> <h2 class="text-lg font-semibold text-white mb-4">Recent Activity</h2> <div id="activityList" class="space-y-3"> <p class="text-gray-400 text-sm">Loading...</p> </div> </div> </div> ` })} `;
}, "/home/ahmed/Documents/ksa_v3/src/pages/portal/index.astro", void 0);

const $$file = "/home/ahmed/Documents/ksa_v3/src/pages/portal/index.astro";
const $$url = "/portal";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
