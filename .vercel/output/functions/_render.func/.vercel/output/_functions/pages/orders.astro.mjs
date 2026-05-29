import { a as createComponent, r as renderTemplate, l as renderComponent, f as createAstro, m as maybeRenderHead } from '../chunks/vendor_LCkWoqkp.mjs';
export { g as renderers } from '../chunks/vendor_LCkWoqkp.mjs';
import 'kleur/colors';
import { $ as $$Layout } from '../chunks/Layout_OYn8kqkt.mjs';

const $$Astro = createAstro();
const $$Orders = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Orders;
  const user = Astro2.locals.user;
  const profile = user?.profile;
  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return Astro2.redirect("/dashboard");
  }
  return renderTemplate`${renderComponent($$result, "Layout", $$Layout, { "title": "Order Batches - KSA CRM" }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="max-w-7xl mx-auto"> <div class="flex justify-between items-center mb-6"> <h1 class="text-2xl font-bold text-white">Order Batches</h1> <button id="createBatchBtn" class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
+ New Order Batch
</button> </div> <!-- Filters --> <div class="bg-gray-800 rounded-lg p-4 mb-6"> <div class="flex gap-4 items-end"> <select id="statusFilter" class="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"> <option value="">All Status</option> <option value="draft">Draft</option> <option value="availability_sent">Availability Sent</option> <option value="po_sent">PO Sent</option> <option value="partially_delivered">Partially Delivered</option> <option value="completed">Completed</option> <option value="cancelled">Cancelled</option> </select> </div> </div> <!-- Batches List --> <div id="batchesList" class="space-y-4"> <div class="text-center text-gray-400 py-8">Loading order batches...</div> </div> <!-- Upload Orders Modal --> <div id="uploadModal" class="fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center"> <div class="bg-gray-800 rounded-xl p-6 w-full max-w-xl mx-4"> <h2 class="text-xl font-bold text-white mb-2">Upload Orders</h2> <p class="text-sm text-gray-400 mb-4">XLSX/CSV with columns: barcode, order_qty, asin, title, total cost. Items will be matched against your products database by barcode.</p> <input type="hidden" id="uploadBatchId"> <div class="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center mb-4"> <input type="file" id="ordersFileInput" accept=".xlsx,.xls,.csv" class="hidden"> <p class="text-gray-400">Drop file here or <button type="button" class="text-purple-400 hover:text-purple-300" onclick="document.getElementById('ordersFileInput').click()">browse</button></p> <p id="selectedOrdersFile" class="text-gray-500 text-xs mt-2">No file selected</p> </div> <div id="ordersUploadProgress" class="hidden mb-4 text-sm text-gray-400">Processing…</div> <div id="ordersUploadResult" class="hidden mb-4 text-sm"></div> <div class="flex justify-end gap-3"> <button type="button" id="closeUploadModal" class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500">Close</button> <button type="button" id="startOrdersUpload" disabled class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">Upload</button> </div> </div> </div> <!-- Create Batch Modal --> <div id="createModal" class="fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center"> <div class="bg-gray-800 rounded-xl p-6 w-full max-w-lg mx-4"> <h2 class="text-xl font-bold text-white mb-4">Create Order Batch</h2> <form id="createForm" class="space-y-4"> <div> <label class="block text-sm text-gray-400 mb-1">Batch Name *</label> <input type="text" name="name" required placeholder="e.g. March 2025 Order" class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"> </div> <div> <label class="block text-sm text-gray-400 mb-1">PO Number</label> <input type="text" name="po_number" placeholder="e.g. PO-2025-001" class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"> </div> <div> <label class="block text-sm text-gray-400 mb-1">Notes</label> <textarea name="notes" rows="3" placeholder="Optional notes..." class="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-purple-500 focus:outline-none"></textarea> </div> <div class="flex justify-end gap-3 pt-2"> <button type="button" id="closeCreateModal" class="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-500">Cancel</button> <button type="submit" class="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">Create Batch</button> </div> </form> </div> </div> </div> ` })} `;
}, "/home/ahmed/Documents/ksa_v3/src/pages/orders.astro", void 0);

const $$file = "/home/ahmed/Documents/ksa_v3/src/pages/orders.astro";
const $$url = "/orders";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Orders,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
