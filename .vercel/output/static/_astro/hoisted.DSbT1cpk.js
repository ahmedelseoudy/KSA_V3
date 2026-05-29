import"./hoisted.DVsQhnVd.js";const i={draft:"bg-gray-700 text-gray-300",sent:"bg-blue-900/30 text-blue-300",confirmed:"bg-purple-900/30 text-purple-300",partially_delivered:"bg-yellow-900/30 text-yellow-300",delivered:"bg-green-900/30 text-green-300",cancelled:"bg-red-900/30 text-red-300"};async function p(){const e=await fetch("/api/companies");if(!e.ok)return;const{data:n}=await e.json(),t=document.getElementById("companyFilter");t.innerHTML=`<option value="">All Companies</option>${(n||[]).map(a=>`<option value="${a.id}">${a.name}</option>`).join("")}`}async function s(){const e=document.getElementById("companyFilter")?.value||"",n=document.getElementById("statusFilter")?.value||"",t=new URLSearchParams;e&&t.set("company_id",e),n&&t.set("status",n);const a=await fetch(`/api/purchase-orders?${t}`);if(!a.ok)return;const{data:l,count:m}=await a.json(),r=l||[];document.getElementById("totalPOs").textContent=String(r.length);const d=r.reduce((o,c)=>o+Number(c.total_amount||0),0);document.getElementById("totalValue").textContent=`$${d.toFixed(0)}`,document.getElementById("pendingDelivery").textContent=String(r.filter(o=>["sent","confirmed","partially_delivered"].includes(o.status)).length),document.getElementById("fullyDelivered").textContent=String(r.filter(o=>o.status==="delivered").length),u(r)}function u(e){const n=document.getElementById("poTableBody");if(n){if(e.length===0){n.innerHTML='<tr><td colspan="7" class="px-4 py-8 text-center text-gray-400">No purchase orders found.</td></tr>';return}n.innerHTML=e.map(t=>`
      <tr class="border-b border-gray-700/50 hover:bg-gray-700/30">
        <td class="px-4 py-3 text-white font-mono">${t.po_number||"-"}</td>
        <td class="px-4 py-3 text-white">${t.company?.name||"-"}</td>
        <td class="px-4 py-3 text-right text-white">${t.total_items}</td>
        <td class="px-4 py-3 text-right text-white">$${Number(t.total_amount).toFixed(2)}</td>
        <td class="px-4 py-3 text-center">
          <span class="px-2 py-0.5 text-xs rounded-full ${i[t.status]||"bg-gray-700 text-gray-300"}">${t.status.replace(/_/g," ")}</span>
        </td>
        <td class="px-4 py-3 text-gray-400 text-sm">${new Date(t.created_at).toLocaleDateString()}</td>
        <td class="px-4 py-3 text-center">
          <a href="/deliveries?company_id=${t.company_id}" class="text-sm text-purple-400 hover:text-purple-300">Track</a>
        </td>
      </tr>
    `).join("")}}document.getElementById("companyFilter")?.addEventListener("change",s);document.getElementById("statusFilter")?.addEventListener("change",s);p();s();
