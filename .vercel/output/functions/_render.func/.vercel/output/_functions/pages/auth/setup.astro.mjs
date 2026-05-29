import { a as createComponent, r as renderTemplate, l as renderComponent, f as createAstro, m as maybeRenderHead, F as Fragment, b as addAttribute } from '../../chunks/vendor_LCkWoqkp.mjs';
export { g as renderers } from '../../chunks/vendor_LCkWoqkp.mjs';
import 'kleur/colors';
import { $ as $$Layout } from '../../chunks/Layout_OYn8kqkt.mjs';
import { c as createSupabaseServerClient } from '../../chunks/supabase-server_BsVI-CzH.mjs';

const $$Astro = createAstro();
const $$Setup = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Setup;
  const url = new URL(Astro2.request.url);
  const token = url.searchParams.get("token") || "";
  let valid = false;
  let email = "";
  let errorMsg = "";
  if (token) {
    const supabase = createSupabaseServerClient(Astro2.cookies);
    const { data, error } = await supabase.rpc("validate_setup_token", { p_token: token });
    if (error) {
      errorMsg = error.message;
    } else if (Array.isArray(data) && data.length > 0) {
      valid = true;
      email = data[0].email;
    } else {
      errorMsg = "This link is invalid or has expired. Please ask the admin to resend the invitation.";
    }
  } else {
    errorMsg = "Missing setup token.";
  }
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Set your password \u2014 KSA CRM", "showNavigation": false }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="min-h-screen flex items-center justify-center px-4"> <div class="w-full max-w-md bg-gray-800 rounded-xl p-8 border border-gray-700"> <h1 class="text-2xl font-bold text-white mb-2">Set your password</h1> ${valid ? renderTemplate`${renderComponent($$result2, "Fragment", Fragment, {}, { "default": ($$result3) => renderTemplate` <p class="text-gray-400 text-sm mb-6">For <strong>${email}</strong></p> <form id="setupForm" class="space-y-4"> <input type="hidden" name="token"${addAttribute(token, "value")}> <div> <label class="block text-sm text-gray-400 mb-1">New password</label> <input type="password" name="password" required minlength="8" class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"> </div> <div> <label class="block text-sm text-gray-400 mb-1">Confirm password</label> <input type="password" name="confirm" required minlength="8" class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"> </div> <div id="errorBox" class="hidden text-sm text-red-400"></div> <button type="submit" class="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
Save & log in
</button> </form> ` })}` : renderTemplate`${renderComponent($$result2, "Fragment", Fragment, {}, { "default": ($$result3) => renderTemplate` <div class="text-red-400 text-sm">${errorMsg}</div> <a href="/login" class="mt-6 inline-block text-purple-400 hover:text-purple-300">Back to login</a> ` })}`} </div> </div> ` })} `;
}, "/home/ahmed/Documents/ksa_v3/src/pages/auth/setup.astro", void 0);

const $$file = "/home/ahmed/Documents/ksa_v3/src/pages/auth/setup.astro";
const $$url = "/auth/setup";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Setup,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
