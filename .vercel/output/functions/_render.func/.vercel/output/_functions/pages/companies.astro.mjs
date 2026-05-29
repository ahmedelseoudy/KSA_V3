import { a as createComponent, r as renderTemplate, l as renderComponent, f as createAstro, m as maybeRenderHead } from '../chunks/vendor_LCkWoqkp.mjs';
export { g as renderers } from '../chunks/vendor_LCkWoqkp.mjs';
import 'kleur/colors';
import { $ as $$Layout } from '../chunks/Layout_OYn8kqkt.mjs';

const $$Astro = createAstro();
const $$Companies = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Companies;
  const user = Astro2.locals.user;
  const profile = user?.profile;
  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return Astro2.redirect("/dashboard");
  }
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Companies - KSA CRM" }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="max-w-7xl mx-auto"> <div class="flex justify-between items-center mb-6"> <h1 class="text-2xl font-bold text-white">Companies</h1> <button id="addCompanyBtn" class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
+ Add Company
</button> </div> <!-- Search --> <div class="bg-gray-800 rounded-lg p-4 mb-6"> <div class="flex gap-4 items-end"> <div class="flex-1"> <input type="text" id="searchInput" placeholder="Search companies..." class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none"> </div> <select id="statusFilter" class="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"> <option value="">All Status</option> <option value="active">Active</option> <option value="inactive">Inactive</option> <option value="suspended">Suspended</option> </select> </div> </div> <!-- Companies Grid --> <div id="companiesGrid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"> <div class="col-span-full text-center text-gray-400 py-8">Loading companies...</div> </div> <!-- Add/Edit Company Modal --> <div id="companyModal" class="fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center"> <div class="bg-gray-800 rounded-xl p-6 w-full max-w-lg mx-4"> <h2 class="text-xl font-bold text-white mb-4" id="modalTitle">Add Company</h2> <form id="companyForm" class="space-y-4"> <input type="hidden" name="id"> <div> <label class="block text-sm text-gray-400 mb-1">Company Name *</label> <input type="text" name="name" required class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"> </div> <div> <label class="block text-sm text-gray-400 mb-1">Primary Email</label> <input type="email" name="email" class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"> <p class="text-xs text-gray-500 mt-1">Login email for the company portal. An invite link will be emailed when you create a new company.</p> </div> <div> <label class="block text-sm text-gray-400 mb-1">Additional Emails (CC)</label> <div id="additionalEmailsContainer" class="flex flex-wrap gap-1 p-2 bg-gray-700 border border-gray-600 rounded-lg min-h-[42px]"></div> <input type="email" id="additionalEmailInput" placeholder="Type an email and press Enter" class="mt-2 w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"> </div> <div> <label class="block text-sm text-gray-400 mb-1">Contact Person</label> <input type="text" name="contact_person" class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"> </div> <div> <label class="block text-sm text-gray-400 mb-1">Phone</label> <input type="text" name="phone" class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"> </div> <div> <label class="block text-sm text-gray-400 mb-1">Address</label> <textarea name="address" rows="2" class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"></textarea> </div> <div class="flex justify-end gap-3 pt-2"> <button type="button" id="closeModal" class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500">Cancel</button> <button type="submit" class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">Save</button> </div> </form> </div> </div> </div> ` })} `;
}, "/home/ahmed/Documents/ksa_v3/src/pages/companies.astro", void 0);

const $$file = "/home/ahmed/Documents/ksa_v3/src/pages/companies.astro";
const $$url = "/companies";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Companies,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
