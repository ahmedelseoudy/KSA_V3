import { a as createComponent, f as createAstro } from '../chunks/vendor_LCkWoqkp.mjs';
export { g as renderers } from '../chunks/vendor_LCkWoqkp.mjs';
import 'kleur/colors';
import 'clsx';

const $$Astro = createAstro();
const $$Index = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Index;
  const user = Astro2.locals.user;
  const profile = user?.profile;
  if (!user) {
    return Astro2.redirect("/login");
  }
  if (profile?.role === "company") {
    return Astro2.redirect("/portal");
  }
  return Astro2.redirect("/dashboard");
}, "/home/ahmed/Documents/ksa_v3/src/pages/index.astro", void 0);

const $$file = "/home/ahmed/Documents/ksa_v3/src/pages/index.astro";
const $$url = "";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Index,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
