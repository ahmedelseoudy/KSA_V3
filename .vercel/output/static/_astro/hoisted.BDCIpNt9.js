import"./hoisted.DVsQhnVd.js";async function c(){const[a,n,t,o]=await Promise.all([fetch("/api/orders?limit=5"),fetch("/api/companies"),fetch("/api/products?limit=1"),fetch("/api/purchase-orders")]);if(a.ok){const{data:e,count:s}=await a.json();document.getElementById("statBatches").textContent=String(s||e?.length||0),i(e||[])}if(n.ok){const{count:e,data:s}=await n.json();document.getElementById("statCompanies").textContent=String(e||s?.length||0)}if(t.ok){const{count:e}=await t.json();document.getElementById("statProducts").textContent=String(e||0)}if(o.ok){const{data:e}=await o.json(),s=(e||[]).filter(r=>!["delivered","cancelled"].includes(r.status));document.getElementById("statPOs").textContent=String(s.length)}}function i(a){const n=document.getElementById("recentBatches");if(n){if(a.length===0){n.innerHTML='<p class="text-gray-500 text-sm">No order batches yet. <a href="/orders" class="text-purple-400 hover:text-purple-300">Create one</a></p>';return}n.innerHTML=a.slice(0,5).map(t=>`
      <div class="flex justify-between items-center py-2 border-b border-gray-700/50 last:border-0">
        <div>
          <p class="text-white text-sm font-medium">${t.name}</p>
          <p class="text-gray-500 text-xs">${t.total_items} items · ${new Date(t.created_at).toLocaleDateString()}</p>
        </div>
        <span class="px-2 py-0.5 text-xs rounded-full ${t.status==="completed"?"bg-green-900/30 text-green-300":t.status==="draft"?"bg-gray-700 text-gray-300":"bg-blue-900/30 text-blue-300"}">${t.status.replace(/_/g," ")}</span>
      </div>
    `).join("")}}c();
