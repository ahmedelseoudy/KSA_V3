import"./hoisted.DVsQhnVd.js";async function a(){const s=await fetch("/api/purchase-orders");if(!s.ok)return;const{data:t}=await s.json();n(t||[])}function n(s){const t=document.getElementById("poList");if(t){if(s.length===0){t.innerHTML='<div class="text-center text-gray-400 py-8">No purchase orders yet.</div>';return}t.innerHTML=s.map(e=>`
      <div class="bg-gray-800 rounded-lg border border-gray-700 p-5">
        <div class="flex justify-between items-start mb-3">
          <div>
            <h3 class="text-lg font-semibold text-white">PO: ${e.po_number||"N/A"}</h3>
            <p class="text-sm text-gray-400">${e.total_items} items · $${Number(e.total_amount||0).toFixed(2)}</p>
            <p class="text-xs text-gray-500 mt-1">Created: ${new Date(e.created_at).toLocaleDateString()}</p>
          </div>
          <div class="flex items-center gap-3">
            <span class="px-3 py-1 text-xs rounded-full ${e.status==="delivered"?"bg-green-900/30 text-green-300":e.status==="confirmed"?"bg-purple-900/30 text-purple-300":e.status==="partially_delivered"?"bg-yellow-900/30 text-yellow-300":"bg-blue-900/30 text-blue-300"}">${e.status.replace(/_/g," ")}</span>
            ${e.status==="sent"?`
              <button onclick="window.confirmPO('${e.id}')" class="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700">
                Confirm
              </button>
            `:""}
          </div>
        </div>
        <button onclick="window.toggleItems('${e.id}')" class="text-sm text-purple-400 hover:text-purple-300 mt-2">View Items ▼</button>
        <div id="items-${e.id}" class="hidden mt-4"></div>
      </div>
    `).join("")}}window.confirmPO=async s=>{if(!confirm("Confirm this purchase order?"))return;(await fetch("/api/purchase-orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"confirm",id:s})})).ok?(alert("Purchase order confirmed."),a()):alert("Failed to confirm.")};window.toggleItems=async s=>{const t=document.getElementById(`items-${s}`);if(!t)return;if(!t.classList.contains("hidden")&&t.innerHTML){t.classList.add("hidden");return}t.classList.remove("hidden"),t.innerHTML='<p class="text-gray-400">Loading...</p>';const e=await fetch(`/api/purchase-orders?id=${s}&items=true`);if(!e.ok)return;const{data:i}=await e.json();t.innerHTML=`
      <table class="w-full text-sm">
        <thead class="bg-gray-700/50">
          <tr>
            <th class="px-3 py-2 text-left text-gray-300">Product</th>
            <th class="px-3 py-2 text-right text-gray-300">Qty</th>
            <th class="px-3 py-2 text-right text-gray-300">Boxes</th>
            <th class="px-3 py-2 text-right text-gray-300">Price/Box</th>
            <th class="px-3 py-2 text-right text-gray-300">Total</th>
            <th class="px-3 py-2 text-center text-gray-300">Delivery</th>
          </tr>
        </thead>
        <tbody>
          ${(i||[]).map(r=>`
            <tr class="border-b border-gray-700/50">
              <td class="px-3 py-2 text-white">${r.product?.title||r.product?.barcode||"-"}</td>
              <td class="px-3 py-2 text-right text-white">${r.quantity}</td>
              <td class="px-3 py-2 text-right text-white">${Number(r.boxes).toFixed(1)}</td>
              <td class="px-3 py-2 text-right text-white">$${Number(r.price_per_box).toFixed(2)}</td>
              <td class="px-3 py-2 text-right text-white">$${Number(r.total_price).toFixed(2)}</td>
              <td class="px-3 py-2 text-center">
                <span class="px-2 py-0.5 text-xs rounded-full ${r.delivery_status==="delivered"?"bg-green-900/30 text-green-300":r.delivery_status==="partial"?"bg-yellow-900/30 text-yellow-300":"bg-gray-700 text-gray-400"}">${r.delivered_qty}/${r.quantity}</span>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `};async function o(){await a();const t=new URLSearchParams(window.location.search).get("focus");t&&setTimeout(()=>{window.toggleItems(t),document.querySelector(`#items-${t}`)?.closest(".bg-gray-800")?.scrollIntoView({behavior:"smooth",block:"start"})},100)}o();
