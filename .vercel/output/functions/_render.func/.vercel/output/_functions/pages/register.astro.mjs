import { a as createComponent, r as renderTemplate, l as renderComponent, f as createAstro, m as maybeRenderHead, b as addAttribute } from '../chunks/vendor_LCkWoqkp.mjs';
export { g as renderers } from '../chunks/vendor_LCkWoqkp.mjs';
import 'kleur/colors';
import { $ as $$AuthLayout } from '../chunks/AuthLayout_BkDqWpaC.mjs';

const $$Astro = createAstro();
const $$Register = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Register;
  const url = new URL(Astro2.request.url);
  const inviteCode = url.searchParams.get("code");
  const email = url.searchParams.get("email");
  if (!inviteCode) {
    return Astro2.redirect("/login");
  }
  let inviteValid = false;
  let inviteEmail = email || "";
  try {
    const { supabase } = await import('../chunks/supabase_DD4i_ZTA.mjs');
    const { data: invitation, error } = await supabase.from("invitations").select("*").eq("invite_code", inviteCode).single();
    if (invitation && !invitation.used_at && new Date(invitation.expires_at) > /* @__PURE__ */ new Date()) {
      inviteValid = true;
      inviteEmail = invitation.email;
    }
  } catch (error) {
    console.error("Error verifying invite:", error);
  }
  if (!inviteValid) {
    return Astro2.redirect("/login?error=invalid-invite");
  }
  return renderTemplate`${renderComponent($$result, "AuthLayout", $$AuthLayout, { "title": "Register - KSA V2" }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8"> <div class="max-w-md w-full space-y-8"> <div> <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
Create your account
</h2> <p class="mt-2 text-center text-sm text-gray-600">
Complete your registration to access KSA V2
</p> </div> <form class="mt-8 space-y-6" id="registerForm"> <input type="hidden" name="inviteCode"${addAttribute(inviteCode, "value")}> <div class="rounded-md shadow-sm space-y-4"> <div> <label for="email" class="block text-sm font-medium text-gray-700">Email address</label> <input id="email" name="email" type="email" autocomplete="email" required readonly${addAttribute(inviteEmail, "value")} class="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md bg-gray-50 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"> <p class="mt-1 text-xs text-gray-500">This email was invited to join the system</p> </div> <div> <label for="fullName" class="block text-sm font-medium text-gray-700">Full Name</label> <input id="fullName" name="fullName" type="text" autocomplete="name" required class="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="Enter your full name"> </div> <div> <label for="password" class="block text-sm font-medium text-gray-700">Password</label> <input id="password" name="password" type="password" autocomplete="new-password" required minlength="6" class="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="Choose a secure password"> <p class="mt-1 text-xs text-gray-500">Minimum 6 characters</p> </div> <div> <label for="confirmPassword" class="block text-sm font-medium text-gray-700">Confirm Password</label> <input id="confirmPassword" name="confirmPassword" type="password" autocomplete="new-password" required minlength="6" class="mt-1 appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="Confirm your password"> </div> </div> <div id="error-message" class="hidden bg-red-50 border border-red-200 rounded-md p-4"> <div class="flex"> <div class="ml-3"> <h3 class="text-sm font-medium text-red-800" id="error-text"> <!-- Error message will be inserted here --> </h3> </div> </div> </div> <div id="success-message" class="hidden bg-green-50 border border-green-200 rounded-md p-4"> <div class="flex"> <div class="ml-3"> <h3 class="text-sm font-medium text-green-800">
Registration successful! Your account is pending approval.
</h3> <p class="mt-1 text-sm text-green-700">
You will receive an email notification once your account is approved.
</p> </div> </div> </div> <div> <button type="submit" class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed" id="submitButton"> <span class="absolute left-0 inset-y-0 flex items-center pl-3"> <svg class="h-5 w-5 text-indigo-500 group-hover:text-indigo-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"> <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z"></path> </svg> </span> <span id="button-text">Create Account</span> </button> </div> <div class="text-center"> <p class="text-sm text-gray-600">
Already have an account?
<a href="/login" class="font-medium text-indigo-600 hover:text-indigo-500">
Sign in here
</a> </p> </div> </form> </div> </div> ` })}  `;
}, "/home/ahmed/Documents/ksa_v3/src/pages/register.astro", void 0);

const $$file = "/home/ahmed/Documents/ksa_v3/src/pages/register.astro";
const $$url = "/register";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Register,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
