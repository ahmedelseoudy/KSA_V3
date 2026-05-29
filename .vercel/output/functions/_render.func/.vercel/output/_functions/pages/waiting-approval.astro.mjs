import { a as createComponent, r as renderTemplate, l as renderComponent, f as createAstro, m as maybeRenderHead } from '../chunks/vendor_LCkWoqkp.mjs';
export { g as renderers } from '../chunks/vendor_LCkWoqkp.mjs';
import 'kleur/colors';
import { $ as $$AuthLayout } from '../chunks/AuthLayout_BkDqWpaC.mjs';
import { g as getCurrentUser } from '../chunks/auth_DP40s9-m.mjs';

const $$Astro = createAstro();
const $$WaitingApproval = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$WaitingApproval;
  let user = null;
  try {
    user = await getCurrentUser(Astro2.request);
  } catch (error) {
    console.error("Error getting user:", error);
  }
  if (user?.profile?.status === "approved") {
    return Astro2.redirect("/");
  }
  if (!user || user.profile?.status !== "pending") {
    return Astro2.redirect("/login");
  }
  return renderTemplate`${renderComponent($$result, "AuthLayout", $$AuthLayout, { "title": "Waiting for Approval - KSA V2" }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8"> <div class="max-w-md w-full space-y-8"> <div class="text-center"> <!-- Pending approval icon --> <div class="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-yellow-100 mb-6"> <svg class="h-8 w-8 text-yellow-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"> <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path> </svg> </div> <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
Account Pending Approval
</h2> <div class="mt-4 space-y-4"> <p class="text-center text-lg text-gray-600">
Welcome, ${user?.email}!
</p> <p class="text-center text-sm text-gray-500">
Your account has been successfully created and is currently pending approval from an administrator.
</p> <div class="bg-blue-50 border border-blue-200 rounded-md p-4 mt-6"> <div class="flex"> <div class="flex-shrink-0"> <svg class="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"> <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path> </svg> </div> <div class="ml-3"> <h3 class="text-sm font-medium text-blue-800">
What happens next?
</h3> <div class="mt-2 text-sm text-blue-700"> <ul class="list-disc list-inside space-y-1"> <li>An administrator has been notified of your registration</li> <li>They will review your account and approve access</li> <li>You'll receive an email notification once approved</li> <li>After approval, you can sign in and access the system</li> </ul> </div> </div> </div> </div> <div class="bg-gray-50 border border-gray-200 rounded-md p-4 mt-6"> <div class="flex"> <div class="flex-shrink-0"> <svg class="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"> <path fill-rule="evenodd" d="M18 3a1 1 0 00-1.447-.894L8.763 6H5a3 3 0 000 6h.28l1.771 5.316A1 1 0 008 18h1a1 1 0 001-1v-4.382l6.553 3.276A1 1 0 0018 15V3z" clip-rule="evenodd"></path> </svg> </div> <div class="ml-3"> <h3 class="text-sm font-medium text-gray-800">
Need help?
</h3> <p class="mt-1 text-sm text-gray-600">
If you have questions about your account or need urgent access, please contact your system administrator.
</p> </div> </div> </div> </div> <div class="mt-8 space-y-4"> <button id="refreshButton" class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-indigo-600 bg-white border-indigo-600 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"> <svg class="h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"> <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path> </svg>
Check Approval Status
</button> <button id="logoutButton" class="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
Sign Out
</button> </div> <div class="mt-6"> <p class="text-xs text-gray-400">
Account created: ${new Date(user?.profile?.created_at || "").toLocaleDateString()} </p> </div> </div> </div> </div> ` })}  `;
}, "/home/ahmed/Documents/ksa_v3/src/pages/waiting-approval.astro", void 0);

const $$file = "/home/ahmed/Documents/ksa_v3/src/pages/waiting-approval.astro";
const $$url = "/waiting-approval";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$WaitingApproval,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
