import"./hoisted.DVsQhnVd.js";async function l(){const a=await fetch("/api/companies");if(!a.ok)return;const{data:t}=await a.json(),e=document.getElementById("companyFilter");e.innerHTML=`<option value="">All Companies</option>${(t||[]).map(r=>`<option value="${r.id}">${r.name}</option>`).join("")}`}async function n(){const a=document.getElementById("companyFilter")?.value||"",t=document.getElementById("statusFilter")?.value||"",e=new URLSearchParams;a&&e.set("company_id",a),t&&e.set("status",t);const r=await fetch(`/api/purchase-orders?${e}`);if(!r.ok)return;const{data:s}=await r.json();o(s||[])}function o(a){const t=document.getElementById("poList");if(t){if(a.length===0){t.innerHTML='<div class="text-center text-gray-400 py-8">No purchase orders found.</div>';return}t.innerHTML=a.map(e=>`
      <div class="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <div class="p-4 flex justify-between items-center cursor-pointer" onclick="window.togglePOItems('${e.id}')">
          <div>
            <h3 class="text-white font-semibold">${e.company?.name||"Unknown"} - ${e.po_number||"No PO#"}</h3>
            <p class="text-sm text-gray-400">${e.total_items} items · $${Number(e.total_amount||0).toFixed(2)}</p>
          </div>
          <div class="flex items-center gap-3">
            <span class="px-3 py-1 text-xs rounded-full ${e.status==="delivered"?"bg-green-900/30 text-green-300":e.status==="partially_delivered"?"bg-yellow-900/30 text-yellow-300":"bg-blue-900/30 text-blue-300"}">${e.status.replace(/_/g," ")}</span>
            <span class="text-gray-400 text-sm">▼</span>
          </div>
        </div>
        <div id="po-items-${e.id}" class="hidden border-t border-gray-700"></div>
      </div>
    `).join("")}}window.togglePOItems=async a=>{const t=document.getElementById(`po-items-${a}`);if(!t)return;if(!t.classList.contains("hidden")&&t.innerHTML){t.classList.add("hidden");return}t.classList.remove("hidden"),t.innerHTML='<div class="p-4 text-gray-400">Loading items...</div>';const e=await fetch(`/api/purchase-orders?id=${a}&items=true`);if(!e.ok)return;const{data:r}=await e.json();t.innerHTML=`
      <div class="p-4 overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-700/50">
            <tr>
              <th class="px-3 py-2 text-left text-gray-300">Product</th>
              <th class="px-3 py-2 text-right text-gray-300">Ordered</th>
              <th class="px-3 py-2 text-right text-gray-300">Boxes</th>
              <th class="px-3 py-2 text-right text-gray-300">Price</th>
              <th class="px-3 py-2 text-right text-gray-300">Delivered</th>
              <th class="px-3 py-2 text-center text-gray-300">Status</th>
              <th class="px-3 py-2 text-left text-gray-300">Notes</th>
              <th class="px-3 py-2 text-center text-gray-300">Action</th>
            </tr>
          </thead>
          <tbody>
            ${(r||[]).map(s=>`
              <tr class="border-b border-gray-700/50" data-item-id="${s.id}">
                <td class="px-3 py-2 text-white">${s.product?.title||s.product?.barcode||"-"}</td>
                <td class="px-3 py-2 text-right text-white">${s.quantity}</td>
                <td class="px-3 py-2 text-right text-white">${Number(s.boxes).toFixed(1)}</td>
                <td class="px-3 py-2 text-right text-white">$${Number(s.total_price).toFixed(2)}</td>
                <td class="px-3 py-2 text-right">
                  <input type="number" class="delivered-input w-20 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs text-right"
                    data-item-id="${s.id}" value="${s.delivered_qty}" min="0" max="${s.quantity}" />
                </td>
                <td class="px-3 py-2 text-center">
                  <span class="px-2 py-0.5 text-xs rounded-full ${s.delivery_status==="delivered"?"bg-green-900/30 text-green-300":s.delivery_status==="partial"?"bg-yellow-900/30 text-yellow-300":"bg-gray-700 text-gray-400"}">${s.delivery_status}</span>
                </td>
                <td class="px-3 py-2">
                  <input type="text" class="notes-input w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs"
                    data-item-id="${s.id}" value="${s.delivery_notes||""}" placeholder="Notes..." />
                </td>
                <td class="px-3 py-2 text-center">
                  <button onclick="window.saveDelivery('${s.id}', '${a}')" class="text-xs text-purple-400 hover:text-purple-300">Save</button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        <div class="mt-3 flex justify-end">
          <button onclick="window.saveAllDeliveries('${a}')" class="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700">
            Save All Changes
          </button>
        </div>
      </div>
    `};window.saveDelivery=async(a,t)=>{const e=document.getElementById(`po-items-${t}`);if(!e)return;const r=e.querySelector(`.delivered-input[data-item-id="${a}"]`),s=e.querySelector(`.notes-input[data-item-id="${a}"]`);(await fetch("/api/purchase-orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"update_delivery",items:[{id:a,delivered_qty:parseInt(r.value)||0,delivery_notes:s.value}]})})).ok?n():alert("Failed to save delivery")};window.saveAllDeliveries=async a=>{const t=document.getElementById(`po-items-${a}`);if(!t)return;const e=[];t.querySelectorAll(".delivered-input").forEach(s=>{const i=s.dataset.itemId,d=t.querySelector(`.notes-input[data-item-id="${i}"]`);e.push({id:i,delivered_qty:parseInt(s.value)||0,delivery_notes:d?.value||""})}),(await fetch("/api/purchase-orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"update_delivery",items:e})})).ok?(alert("Deliveries saved successfully."),n()):alert("Failed to save deliveries")};document.getElementById("companyFilter")?.addEventListener("change",n);document.getElementById("statusFilter")?.addEventListener("change",n);l();n();
