import { a as createComponent, r as renderTemplate, b as addAttribute, d as renderHead, e as renderSlot, f as createAstro } from './vendor_LCkWoqkp.mjs';
import 'kleur/colors';
import 'clsx';
/* empty css                         */

const $$Astro = createAstro();
const $$AuthLayout = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$AuthLayout;
  const { title } = Astro2.props;
  return renderTemplate`<html lang="en"> <head><meta charset="UTF-8"><meta name="description" content="KSA V2 Authentication"><meta name="viewport" content="width=device-width"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><meta name="generator"${addAttribute(Astro2.generator, "content")}><title>${title}</title>${renderHead()}</head> <body class="bg-gray-50 min-h-screen"> ${renderSlot($$result, $$slots["default"])} </body></html>`;
}, "/home/ahmed/Documents/ksa_v3/src/layouts/AuthLayout.astro", void 0);

export { $$AuthLayout as $ };
