import { a as createComponent, r as renderTemplate, l as renderComponent, f as createAstro, m as maybeRenderHead } from '../chunks/vendor_LCkWoqkp.mjs';
export { g as renderers } from '../chunks/vendor_LCkWoqkp.mjs';
import 'kleur/colors';
import { $ as $$AuthLayout } from '../chunks/AuthLayout_BkDqWpaC.mjs';

const $$Astro = createAstro();
const $$Login = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Login;
  const url = new URL(Astro2.request.url);
  const errorParam = url.searchParams.get("error");
  let errorMessage = "";
  switch (errorParam) {
    case "invalid":
      errorMessage = "Invalid email or password. Please try again.";
      break;
    case "general":
      const messageParam = url.searchParams.get("message");
      errorMessage = messageParam ? decodeURIComponent(messageParam) : "An unexpected error occurred.";
      break;
  }
  return renderTemplate`${renderComponent($$result, "AuthLayout", $$AuthLayout, { "title": "Login - KSA V2" }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8"> <div class="max-w-md w-full space-y-8"> <div> <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
Sign in to KSA V2
</h2> </div> ${errorMessage && renderTemplate`<div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert"> <strong class="font-bold">Error:</strong> <span class="block sm:inline">${errorMessage}</span> </div>`} <form class="mt-8 space-y-6" method="POST" action="/api/login" id="loginForm"> <div class="rounded-md shadow-sm -space-y-px"> <div> <label for="email" class="sr-only">Email address</label> <input id="email" name="email" type="email" autocomplete="email" required class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm" placeholder="Email address"> </div> <div> <label for="password" class="sr-only">Password</label> <input id="password" name="password" type="password" autocomplete="current-password" required class="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm" placeholder="Password"> </div> </div> <div> <button type="submit" class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed" id="submitButton"> <span id="button-text">Sign in</span> </button> </div> </form> </div> </div> ` })} `;
}, "/home/ahmed/Documents/ksa_v3/src/pages/login.astro", void 0);

const $$file = "/home/ahmed/Documents/ksa_v3/src/pages/login.astro";
const $$url = "/login";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Login,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
