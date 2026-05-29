import { a as createComponent, r as renderTemplate, l as renderComponent, f as createAstro, m as maybeRenderHead } from '../../chunks/vendor_LCkWoqkp.mjs';
export { g as renderers } from '../../chunks/vendor_LCkWoqkp.mjs';
import 'kleur/colors';
import { $ as $$Layout } from '../../chunks/Layout_OYn8kqkt.mjs';

const $$Astro = createAstro();
const $$Availability = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Availability;
  const user = Astro2.locals.user;
  const profile = user?.profile;
  if (!profile || profile.role !== "company") {
    return Astro2.redirect("/dashboard");
  }
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Availability Requests - Company Portal" }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="max-w-7xl mx-auto"> <h1 class="text-2xl font-bold text-white mb-6">Availability Requests</h1> <p class="text-gray-400 mb-6">Mark items as available or unavailable. Your responses help us process purchase orders quickly.</p> <!-- Availability Orders List --> <div id="availOrdersList" class="space-y-6"> <div class="text-center text-gray-400 py-8">Loading availability requests...</div> </div> </div> ` })} `;
}, "/home/ahmed/Documents/ksa_v3/src/pages/portal/availability.astro", void 0);

const $$file = "/home/ahmed/Documents/ksa_v3/src/pages/portal/availability.astro";
const $$url = "/portal/availability";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Availability,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
