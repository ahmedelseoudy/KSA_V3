import { a as createComponent, r as renderTemplate, l as renderComponent, f as createAstro, m as maybeRenderHead } from '../../chunks/vendor_LCkWoqkp.mjs';
export { g as renderers } from '../../chunks/vendor_LCkWoqkp.mjs';
import 'kleur/colors';
import { $ as $$Layout } from '../../chunks/Layout_OYn8kqkt.mjs';

const $$Astro = createAstro();
const $$PurchaseOrders = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$PurchaseOrders;
  const user = Astro2.locals.user;
  const profile = user?.profile;
  if (!profile || profile.role !== "company") {
    return Astro2.redirect("/dashboard");
  }
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Purchase Orders - Company Portal" }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="max-w-7xl mx-auto"> <h1 class="text-2xl font-bold text-white mb-6">Your Purchase Orders</h1> <div id="poList" class="space-y-4"> <div class="text-center text-gray-400 py-8">Loading purchase orders...</div> </div> </div> ` })} `;
}, "/home/ahmed/Documents/ksa_v3/src/pages/portal/purchase-orders.astro", void 0);

const $$file = "/home/ahmed/Documents/ksa_v3/src/pages/portal/purchase-orders.astro";
const $$url = "/portal/purchase-orders";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$PurchaseOrders,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
