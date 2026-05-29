import"./hoisted.DVsQhnVd.js";async function r(){const a=await fetch("/api/availability");if(!a.ok)return;const{data:t}=await a.json();d(t||[])}function d(a){const t=document.getElementById("availOrdersList");if(t){if(a.length===0){t.innerHTML='<div class="text-center text-gray-400 py-8">No availability requests at this time.</div>';return}t.innerHTML=a.map(e=>`
      <div class="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden" data-ao-id="${e.id}">
        <div class="p-4 flex justify-between items-center border-b border-gray-700">
          <div>
            <h3 class="text-white font-semibold">Availability Request</h3>
            <p class="text-sm text-gray-400">${e.total_items} items · Status: 
              <span class="${e.status==="responded"?"text-green-400":e.status==="partially_responded"?"text-yellow-400":"text-blue-400"}">
                ${e.status.replace(/_/g," ")}
              </span>
            </p>
          </div>
          <div class="flex gap-3 items-center">
            <span class="text-sm text-gray-400">${e.available_count||0} available · ${e.unavailable_count||0} unavailable</span>
            <button onclick="window.loadResponses('${e.id}')" class="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700">
              ${e.status==="responded"?"View":"Respond"}
            </button>
          </div>
        </div>
        <div id="responses-${e.id}" class="hidden"></div>
      </div>
    `).join("")}}window.loadResponses=async a=>{const t=document.getElementById(`responses-${a}`);if(!t)return;if(!t.classList.contains("hidden")&&t.innerHTML){t.classList.add("hidden");return}t.classList.remove("hidden"),t.innerHTML='<div class="p-4 text-gray-400">Loading items...</div>';const e=await fetch(`/api/availability?id=${a}`);if(!e.ok)return;const{data:i}=await e.json();t.innerHTML=`
      <div class="p-4">
        <div class="flex justify-between mb-3">
          <div class="flex gap-2">
            <button onclick="window.markAll('${a}', true)" class="px-3 py-1 text-xs bg-green-700 text-white rounded hover:bg-green-600">Mark All Available</button>
            <button onclick="window.markAll('${a}', false)" class="px-3 py-1 text-xs bg-red-700 text-white rounded hover:bg-red-600">Mark All Unavailable</button>
          </div>
          <button onclick="window.submitResponses('${a}')" class="px-4 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700">Save Responses</button>
        </div>
        <table class="w-full text-sm">
          <thead class="bg-gray-700/50">
            <tr>
              <th class="px-3 py-2 text-left text-gray-300">Barcode</th>
              <th class="px-3 py-2 text-left text-gray-300">Title</th>
              <th class="px-3 py-2 text-right text-gray-300">Qty</th>
              <th class="px-3 py-2 text-right text-gray-300">Boxes</th>
              <th class="px-3 py-2 text-center text-gray-300">Available</th>
              <th class="px-3 py-2 text-left text-gray-300">Comment</th>
            </tr>
          </thead>
          <tbody>
            ${(i||[]).map(s=>`
              <tr class="border-b border-gray-700/50" data-resp-id="${s.id}">
                <td class="px-3 py-2 text-white font-mono text-xs">${s.order_item?.barcode||"-"}</td>
                <td class="px-3 py-2 text-white truncate max-w-xs">${s.order_item?.title||"-"}</td>
                <td class="px-3 py-2 text-right text-white">${s.order_item?.order_qty||0}</td>
                <td class="px-3 py-2 text-right text-white">${Number(s.order_item?.boxes||0).toFixed(1)}</td>
                <td class="px-3 py-2 text-center">
                  <select class="avail-select px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs" data-id="${s.id}">
                    <option value="" ${s.is_available===null?"selected":""}>--</option>
                    <option value="true" ${s.is_available===!0?"selected":""}>Yes</option>
                    <option value="false" ${s.is_available===!1?"selected":""}>No</option>
                  </select>
                </td>
                <td class="px-3 py-2">
                  <input type="text" class="comment-input w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-xs" 
                    data-id="${s.id}" value="${s.comment||""}" placeholder="Optional comment" />
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `};window.markAll=(a,t)=>{const e=document.getElementById(`responses-${a}`);e&&e.querySelectorAll(".avail-select").forEach(i=>{i.value=String(t)})};window.submitResponses=async a=>{const t=document.getElementById(`responses-${a}`);if(!t)return;const e=[];if(t.querySelectorAll(".avail-select").forEach(s=>{const n=s.dataset.id,l=s.value;if(l==="")return;const o=t.querySelector(`.comment-input[data-id="${n}"]`);e.push({id:n,is_available:l==="true",comment:o?.value||null})}),e.length===0){alert("Please mark at least one item before saving.");return}(await fetch("/api/availability",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"respond",availability_order_id:a,responses:e})})).ok?(alert(`Saved ${e.length} responses.`),r()):alert("Failed to save responses. Please try again.")};async function c(){await r();const t=new URLSearchParams(window.location.search).get("focus");t&&setTimeout(()=>{window.loadResponses(t),document.querySelector(`[data-ao-id="${t}"]`)?.scrollIntoView({behavior:"smooth",block:"start"})},100)}c();
