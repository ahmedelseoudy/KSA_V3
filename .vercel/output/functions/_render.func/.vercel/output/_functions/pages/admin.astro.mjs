import { a as createComponent, r as renderTemplate, k as defineScriptVars, l as renderComponent, f as createAstro, m as maybeRenderHead } from '../chunks/vendor_LCkWoqkp.mjs';
export { g as renderers } from '../chunks/vendor_LCkWoqkp.mjs';
import 'kleur/colors';
import { $ as $$Layout } from '../chunks/Layout_OYn8kqkt.mjs';
import { g as getCurrentUser } from '../chunks/auth_DP40s9-m.mjs';

var __freeze = Object.freeze;
var __defProp = Object.defineProperty;
var __template = (cooked, raw) => __freeze(__defProp(cooked, "raw", { value: __freeze(raw || cooked.slice()) }));
var _a;
const $$Astro = createAstro();
const $$Admin = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Admin;
  const user = await getCurrentUser(Astro2.request);
  if (!user || !user.profile) {
    return Astro2.redirect("/login");
  }
  if (user.profile.status !== "approved") {
    return Astro2.redirect("/waiting-approval");
  }
  if (!["admin", "super_admin"].includes(user.profile.role)) {
    return Astro2.redirect("/");
  }
  const isSuper = user.profile.role === "super_admin";
  return renderTemplate(_a || (_a = __template(["", " <script>(function(){", `
  import { supabase } from '../lib/supabase';

  // Global state
  let users = [];
  let filteredUsers = [];
  const currentUser = currentUserId;
  const isSuper = isSuperAdmin;

  // DOM elements
  const usersTableBody = document.getElementById('usersTableBody');
  const loadingMessage = document.getElementById('loadingMessage');
  const noUsersMessage = document.getElementById('noUsersMessage');
  const statusFilter = document.getElementById('statusFilter');
  const roleFilter = document.getElementById('roleFilter');
  const inviteModal = document.getElementById('inviteModal');
  const inviteForm = document.getElementById('inviteForm');
  const inviteEmail = document.getElementById('inviteEmail');

  // Load and display users
  async function loadUsers() {
    try {
      loadingMessage.classList.remove('hidden');
      usersTableBody.innerHTML = '';

      const { data, error } = await supabase
        .from('users_profile')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      users = data || [];
      updateStats();
      applyFilters();
    } catch (error) {
      console.error('Error loading users:', error);
      showNotification('Error loading users', 'error');
    } finally {
      loadingMessage.classList.add('hidden');
    }
  }

  // Update statistics
  function updateStats() {
    const approved = users.filter(u => u.status === 'approved').length;
    const pending = users.filter(u => u.status === 'pending').length;
    const admins = users.filter(u => ['admin', 'super_admin'].includes(u.role)).length;

    document.getElementById('approvedCount').textContent = approved.toString();
    document.getElementById('pendingCount').textContent = pending.toString();
    document.getElementById('totalCount').textContent = users.length.toString();
    document.getElementById('adminCount').textContent = admins.toString();
  }

  // Apply filters
  function applyFilters() {
    const statusFilterValue = statusFilter.value;
    const roleFilterValue = roleFilter.value;

    filteredUsers = users.filter(user => {
      const statusMatch = !statusFilterValue || user.status === statusFilterValue;
      const roleMatch = !roleFilterValue || user.role === roleFilterValue;
      return statusMatch && roleMatch;
    });

    renderUsers();
  }

  // Render users table
  function renderUsers() {
    if (filteredUsers.length === 0) {
      usersTableBody.innerHTML = '';
      noUsersMessage.classList.remove('hidden');
      return;
    }

    noUsersMessage.classList.add('hidden');
    
    usersTableBody.innerHTML = filteredUsers.map(user => \`
      <tr>
        <td class="px-6 py-4 whitespace-nowrap">
          <div class="text-sm font-medium text-gray-900">\${user.email}</div>
          <div class="text-sm text-gray-500">ID: \${user.id.substring(0, 8)}...</div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium \${getRoleBadgeClass(user.role)}">
            \${user.role.replace('_', ' ')}
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium \${getStatusBadgeClass(user.status)}">
            \${user.status}
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          \${new Date(user.created_at).toLocaleDateString()}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
          \${getActionButtons(user)}
        </td>
      </tr>
    \`).join('');

    // Add event listeners to action buttons
    addActionListeners();
  }

  function getRoleBadgeClass(role) {
    switch (role) {
      case 'super_admin': return 'bg-purple-100 text-purple-800';
      case 'admin': return 'bg-blue-100 text-blue-800';
      case 'user': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  function getStatusBadgeClass(status) {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'suspended': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  function getActionButtons(user) {
    if (user.id === currentUser) {
      return '<span class="text-gray-400">Current User</span>';
    }

    let buttons = '';

    // Approval actions
    if (user.status === 'pending') {
      buttons += \`<button onclick="approveUser('\${user.id}')" class="text-green-600 hover:text-green-900 mr-3">Approve</button>\`;
      buttons += \`<button onclick="rejectUser('\${user.id}')" class="text-red-600 hover:text-red-900 mr-3">Reject</button>\`;
    }

    // Suspend/Unsuspend
    if (user.status === 'approved') {
      buttons += \`<button onclick="suspendUser('\${user.id}')" class="text-red-600 hover:text-red-900 mr-3">Suspend</button>\`;
    } else if (user.status === 'suspended') {
      buttons += \`<button onclick="unsuspendUser('\${user.id}')" class="text-green-600 hover:text-green-900 mr-3">Unsuspend</button>\`;
    }

    // Role management (Super Admin only)
    if (isSuper && user.role !== 'super_admin') {
      if (user.role === 'user') {
        buttons += \`<button onclick="promoteToAdmin('\${user.id}')" class="text-blue-600 hover:text-blue-900 mr-3">Make Admin</button>\`;
      } else if (user.role === 'admin') {
        buttons += \`<button onclick="demoteToUser('\${user.id}')" class="text-orange-600 hover:text-orange-900 mr-3">Remove Admin</button>\`;
      }
    }

    return buttons || '<span class="text-gray-400">No actions</span>';
  }

  function addActionListeners() {
    // Action functions are defined globally for onclick handlers
    window.approveUser = approveUser;
    window.rejectUser = rejectUser;
    window.suspendUser = suspendUser;
    window.unsuspendUser = unsuspendUser;
    window.promoteToAdmin = promoteToAdmin;
    window.demoteToUser = demoteToUser;
  }

  // User action functions
  async function approveUser(userId) {
    try {
      const { error } = await supabase
        .from('users_profile')
        .update({
          status: 'approved',
          approved_by: currentUser,
          approved_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) throw error;

      // Log admin action
      await logAdminAction('user_approved', userId);
      
      showNotification('User approved successfully', 'success');
      loadUsers();
    } catch (error) {
      console.error('Error approving user:', error);
      showNotification('Error approving user', 'error');
    }
  }

  async function rejectUser(userId) {
    if (!confirm('Are you sure you want to reject this user? This will delete their account.')) {
      return;
    }

    try {
      // Delete user profile (this will cascade to auth.users due to foreign key)
      const { error } = await supabase
        .from('users_profile')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      await logAdminAction('user_rejected', userId);
      showNotification('User rejected and deleted', 'success');
      loadUsers();
    } catch (error) {
      console.error('Error rejecting user:', error);
      showNotification('Error rejecting user', 'error');
    }
  }

  async function suspendUser(userId) {
    try {
      const { error } = await supabase
        .from('users_profile')
        .update({ status: 'suspended' })
        .eq('id', userId);

      if (error) throw error;

      await logAdminAction('user_suspended', userId);
      showNotification('User suspended', 'success');
      loadUsers();
    } catch (error) {
      console.error('Error suspending user:', error);
      showNotification('Error suspending user', 'error');
    }
  }

  async function unsuspendUser(userId) {
    try {
      const { error } = await supabase
        .from('users_profile')
        .update({ status: 'approved' })
        .eq('id', userId);

      if (error) throw error;

      await logAdminAction('user_unsuspended', userId);
      showNotification('User unsuspended', 'success');
      loadUsers();
    } catch (error) {
      console.error('Error unsuspending user:', error);
      showNotification('Error unsuspending user', 'error');
    }
  }

  async function promoteToAdmin(userId) {
    if (!confirm('Are you sure you want to make this user an admin?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('users_profile')
        .update({ role: 'admin' })
        .eq('id', userId);

      if (error) throw error;

      await logAdminAction('user_promoted_to_admin', userId);
      showNotification('User promoted to admin', 'success');
      loadUsers();
    } catch (error) {
      console.error('Error promoting user:', error);
      showNotification('Error promoting user', 'error');
    }
  }

  async function demoteToUser(userId) {
    if (!confirm('Are you sure you want to remove admin privileges from this user?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('users_profile')
        .update({ role: 'user' })
        .eq('id', userId);

      if (error) throw error;

      await logAdminAction('user_demoted_to_user', userId);
      showNotification('Admin privileges removed', 'success');
      loadUsers();
    } catch (error) {
      console.error('Error demoting user:', error);
      showNotification('Error demoting user', 'error');
    }
  }

  // Log admin actions
  async function logAdminAction(actionType, targetUser) {
    try {
      await supabase
        .from('admin_actions')
        .insert({
          admin_id: currentUser,
          action_type: actionType,
          target_user: targetUser,
          details: { timestamp: new Date().toISOString() }
        });
    } catch (error) {
      console.error('Error logging admin action:', error);
    }
  }

  // Invite user functionality
  async function sendInvite(email) {
    try {
      // Generate invite code
      const inviteCode = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const { error } = await supabase
        .from('invitations')
        .insert({
          email,
          invite_code: inviteCode,
          created_by: currentUser,
          expires_at: expiresAt.toISOString()
        });

      if (error) throw error;

      await logAdminAction('user_invited', undefined);
      
      // Show invite link
      const inviteUrl = \`\${window.location.origin}/register?code=\${inviteCode}&email=\${encodeURIComponent(email)}\`;
      
      showNotification(\`Invite sent! Share this link: \${inviteUrl}\`, 'success');
      
      return inviteCode;
    } catch (error) {
      console.error('Error sending invite:', error);
      throw error;
    }
  }

  // Notification system
  function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = \`fixed top-4 right-4 p-4 rounded-md shadow-lg z-50 \${
      type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
    }\`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 5000);
  }

  // Event listeners
  document.getElementById('logoutButton')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  });

  document.getElementById('refreshDataButton')?.addEventListener('click', loadUsers);

  document.getElementById('inviteUserButton')?.addEventListener('click', () => {
    inviteModal.classList.remove('hidden');
    inviteEmail.focus();
  });

  document.getElementById('cancelInvite')?.addEventListener('click', () => {
    inviteModal.classList.add('hidden');
    inviteForm.reset();
  });

  inviteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
      await sendInvite(inviteEmail.value);
      inviteModal.classList.add('hidden');
      inviteForm.reset();
    } catch (error) {
      showNotification('Error sending invite', 'error');
    }
  });

  statusFilter.addEventListener('change', applyFilters);
  roleFilter.addEventListener('change', applyFilters);

  // Close modal when clicking outside
  inviteModal.addEventListener('click', (e) => {
    if (e.target === inviteModal) {
      inviteModal.classList.add('hidden');
      inviteForm.reset();
    }
  });

  // Initialize
  loadUsers();
})();<\/script> `], ["", " <script>(function(){", `
  import { supabase } from '../lib/supabase';

  // Global state
  let users = [];
  let filteredUsers = [];
  const currentUser = currentUserId;
  const isSuper = isSuperAdmin;

  // DOM elements
  const usersTableBody = document.getElementById('usersTableBody');
  const loadingMessage = document.getElementById('loadingMessage');
  const noUsersMessage = document.getElementById('noUsersMessage');
  const statusFilter = document.getElementById('statusFilter');
  const roleFilter = document.getElementById('roleFilter');
  const inviteModal = document.getElementById('inviteModal');
  const inviteForm = document.getElementById('inviteForm');
  const inviteEmail = document.getElementById('inviteEmail');

  // Load and display users
  async function loadUsers() {
    try {
      loadingMessage.classList.remove('hidden');
      usersTableBody.innerHTML = '';

      const { data, error } = await supabase
        .from('users_profile')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      users = data || [];
      updateStats();
      applyFilters();
    } catch (error) {
      console.error('Error loading users:', error);
      showNotification('Error loading users', 'error');
    } finally {
      loadingMessage.classList.add('hidden');
    }
  }

  // Update statistics
  function updateStats() {
    const approved = users.filter(u => u.status === 'approved').length;
    const pending = users.filter(u => u.status === 'pending').length;
    const admins = users.filter(u => ['admin', 'super_admin'].includes(u.role)).length;

    document.getElementById('approvedCount').textContent = approved.toString();
    document.getElementById('pendingCount').textContent = pending.toString();
    document.getElementById('totalCount').textContent = users.length.toString();
    document.getElementById('adminCount').textContent = admins.toString();
  }

  // Apply filters
  function applyFilters() {
    const statusFilterValue = statusFilter.value;
    const roleFilterValue = roleFilter.value;

    filteredUsers = users.filter(user => {
      const statusMatch = !statusFilterValue || user.status === statusFilterValue;
      const roleMatch = !roleFilterValue || user.role === roleFilterValue;
      return statusMatch && roleMatch;
    });

    renderUsers();
  }

  // Render users table
  function renderUsers() {
    if (filteredUsers.length === 0) {
      usersTableBody.innerHTML = '';
      noUsersMessage.classList.remove('hidden');
      return;
    }

    noUsersMessage.classList.add('hidden');
    
    usersTableBody.innerHTML = filteredUsers.map(user => \\\`
      <tr>
        <td class="px-6 py-4 whitespace-nowrap">
          <div class="text-sm font-medium text-gray-900">\\\${user.email}</div>
          <div class="text-sm text-gray-500">ID: \\\${user.id.substring(0, 8)}...</div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium \\\${getRoleBadgeClass(user.role)}">
            \\\${user.role.replace('_', ' ')}
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium \\\${getStatusBadgeClass(user.status)}">
            \\\${user.status}
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          \\\${new Date(user.created_at).toLocaleDateString()}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
          \\\${getActionButtons(user)}
        </td>
      </tr>
    \\\`).join('');

    // Add event listeners to action buttons
    addActionListeners();
  }

  function getRoleBadgeClass(role) {
    switch (role) {
      case 'super_admin': return 'bg-purple-100 text-purple-800';
      case 'admin': return 'bg-blue-100 text-blue-800';
      case 'user': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  function getStatusBadgeClass(status) {
    switch (status) {
      case 'approved': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'suspended': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  function getActionButtons(user) {
    if (user.id === currentUser) {
      return '<span class="text-gray-400">Current User</span>';
    }

    let buttons = '';

    // Approval actions
    if (user.status === 'pending') {
      buttons += \\\`<button onclick="approveUser('\\\${user.id}')" class="text-green-600 hover:text-green-900 mr-3">Approve</button>\\\`;
      buttons += \\\`<button onclick="rejectUser('\\\${user.id}')" class="text-red-600 hover:text-red-900 mr-3">Reject</button>\\\`;
    }

    // Suspend/Unsuspend
    if (user.status === 'approved') {
      buttons += \\\`<button onclick="suspendUser('\\\${user.id}')" class="text-red-600 hover:text-red-900 mr-3">Suspend</button>\\\`;
    } else if (user.status === 'suspended') {
      buttons += \\\`<button onclick="unsuspendUser('\\\${user.id}')" class="text-green-600 hover:text-green-900 mr-3">Unsuspend</button>\\\`;
    }

    // Role management (Super Admin only)
    if (isSuper && user.role !== 'super_admin') {
      if (user.role === 'user') {
        buttons += \\\`<button onclick="promoteToAdmin('\\\${user.id}')" class="text-blue-600 hover:text-blue-900 mr-3">Make Admin</button>\\\`;
      } else if (user.role === 'admin') {
        buttons += \\\`<button onclick="demoteToUser('\\\${user.id}')" class="text-orange-600 hover:text-orange-900 mr-3">Remove Admin</button>\\\`;
      }
    }

    return buttons || '<span class="text-gray-400">No actions</span>';
  }

  function addActionListeners() {
    // Action functions are defined globally for onclick handlers
    window.approveUser = approveUser;
    window.rejectUser = rejectUser;
    window.suspendUser = suspendUser;
    window.unsuspendUser = unsuspendUser;
    window.promoteToAdmin = promoteToAdmin;
    window.demoteToUser = demoteToUser;
  }

  // User action functions
  async function approveUser(userId) {
    try {
      const { error } = await supabase
        .from('users_profile')
        .update({
          status: 'approved',
          approved_by: currentUser,
          approved_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) throw error;

      // Log admin action
      await logAdminAction('user_approved', userId);
      
      showNotification('User approved successfully', 'success');
      loadUsers();
    } catch (error) {
      console.error('Error approving user:', error);
      showNotification('Error approving user', 'error');
    }
  }

  async function rejectUser(userId) {
    if (!confirm('Are you sure you want to reject this user? This will delete their account.')) {
      return;
    }

    try {
      // Delete user profile (this will cascade to auth.users due to foreign key)
      const { error } = await supabase
        .from('users_profile')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      await logAdminAction('user_rejected', userId);
      showNotification('User rejected and deleted', 'success');
      loadUsers();
    } catch (error) {
      console.error('Error rejecting user:', error);
      showNotification('Error rejecting user', 'error');
    }
  }

  async function suspendUser(userId) {
    try {
      const { error } = await supabase
        .from('users_profile')
        .update({ status: 'suspended' })
        .eq('id', userId);

      if (error) throw error;

      await logAdminAction('user_suspended', userId);
      showNotification('User suspended', 'success');
      loadUsers();
    } catch (error) {
      console.error('Error suspending user:', error);
      showNotification('Error suspending user', 'error');
    }
  }

  async function unsuspendUser(userId) {
    try {
      const { error } = await supabase
        .from('users_profile')
        .update({ status: 'approved' })
        .eq('id', userId);

      if (error) throw error;

      await logAdminAction('user_unsuspended', userId);
      showNotification('User unsuspended', 'success');
      loadUsers();
    } catch (error) {
      console.error('Error unsuspending user:', error);
      showNotification('Error unsuspending user', 'error');
    }
  }

  async function promoteToAdmin(userId) {
    if (!confirm('Are you sure you want to make this user an admin?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('users_profile')
        .update({ role: 'admin' })
        .eq('id', userId);

      if (error) throw error;

      await logAdminAction('user_promoted_to_admin', userId);
      showNotification('User promoted to admin', 'success');
      loadUsers();
    } catch (error) {
      console.error('Error promoting user:', error);
      showNotification('Error promoting user', 'error');
    }
  }

  async function demoteToUser(userId) {
    if (!confirm('Are you sure you want to remove admin privileges from this user?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('users_profile')
        .update({ role: 'user' })
        .eq('id', userId);

      if (error) throw error;

      await logAdminAction('user_demoted_to_user', userId);
      showNotification('Admin privileges removed', 'success');
      loadUsers();
    } catch (error) {
      console.error('Error demoting user:', error);
      showNotification('Error demoting user', 'error');
    }
  }

  // Log admin actions
  async function logAdminAction(actionType, targetUser) {
    try {
      await supabase
        .from('admin_actions')
        .insert({
          admin_id: currentUser,
          action_type: actionType,
          target_user: targetUser,
          details: { timestamp: new Date().toISOString() }
        });
    } catch (error) {
      console.error('Error logging admin action:', error);
    }
  }

  // Invite user functionality
  async function sendInvite(email) {
    try {
      // Generate invite code
      const inviteCode = crypto.randomUUID();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const { error } = await supabase
        .from('invitations')
        .insert({
          email,
          invite_code: inviteCode,
          created_by: currentUser,
          expires_at: expiresAt.toISOString()
        });

      if (error) throw error;

      await logAdminAction('user_invited', undefined);
      
      // Show invite link
      const inviteUrl = \\\`\\\${window.location.origin}/register?code=\\\${inviteCode}&email=\\\${encodeURIComponent(email)}\\\`;
      
      showNotification(\\\`Invite sent! Share this link: \\\${inviteUrl}\\\`, 'success');
      
      return inviteCode;
    } catch (error) {
      console.error('Error sending invite:', error);
      throw error;
    }
  }

  // Notification system
  function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = \\\`fixed top-4 right-4 p-4 rounded-md shadow-lg z-50 \\\${
      type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
    }\\\`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 5000);
  }

  // Event listeners
  document.getElementById('logoutButton')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  });

  document.getElementById('refreshDataButton')?.addEventListener('click', loadUsers);

  document.getElementById('inviteUserButton')?.addEventListener('click', () => {
    inviteModal.classList.remove('hidden');
    inviteEmail.focus();
  });

  document.getElementById('cancelInvite')?.addEventListener('click', () => {
    inviteModal.classList.add('hidden');
    inviteForm.reset();
  });

  inviteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
      await sendInvite(inviteEmail.value);
      inviteModal.classList.add('hidden');
      inviteForm.reset();
    } catch (error) {
      showNotification('Error sending invite', 'error');
    }
  });

  statusFilter.addEventListener('change', applyFilters);
  roleFilter.addEventListener('change', applyFilters);

  // Close modal when clicking outside
  inviteModal.addEventListener('click', (e) => {
    if (e.target === inviteModal) {
      inviteModal.classList.add('hidden');
      inviteForm.reset();
    }
  });

  // Initialize
  loadUsers();
})();<\/script> `])), renderComponent($$result, "Layout", $$Layout, { "title": "Admin Dashboard - KSA V2" }, { "default": ($$result2) => renderTemplate` ${maybeRenderHead()}<div class="min-h-screen bg-gray-50"> <!-- Header --> <header class="bg-white shadow"> <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"> <div class="flex justify-between items-center py-6"> <div class="flex items-center"> <h1 class="text-3xl font-bold text-gray-900">Admin Dashboard</h1> ${isSuper && renderTemplate`<span class="ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
Super Admin
</span>`} </div> <div class="flex items-center space-x-4"> <span class="text-sm text-gray-500">Welcome, ${user.email}</span> <button id="logoutButton" class="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-sm font-medium">
Sign Out
</button> </div> </div> </div> </header> <main class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8"> <!-- Stats Cards --> <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8"> <div class="bg-white overflow-hidden shadow rounded-lg"> <div class="p-5"> <div class="flex items-center"> <div class="flex-shrink-0"> <div class="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center"> <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20"> <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path> </svg> </div> </div> <div class="ml-5 w-0 flex-1"> <dl> <dt class="text-sm font-medium text-gray-500 truncate">Approved Users</dt> <dd class="text-lg font-medium text-gray-900" id="approvedCount">-</dd> </dl> </div> </div> </div> </div> <div class="bg-white overflow-hidden shadow rounded-lg"> <div class="p-5"> <div class="flex items-center"> <div class="flex-shrink-0"> <div class="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center"> <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20"> <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clip-rule="evenodd"></path> </svg> </div> </div> <div class="ml-5 w-0 flex-1"> <dl> <dt class="text-sm font-medium text-gray-500 truncate">Pending Approval</dt> <dd class="text-lg font-medium text-gray-900" id="pendingCount">-</dd> </dl> </div> </div> </div> </div> <div class="bg-white overflow-hidden shadow rounded-lg"> <div class="p-5"> <div class="flex items-center"> <div class="flex-shrink-0"> <div class="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center"> <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20"> <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z"></path> </svg> </div> </div> <div class="ml-5 w-0 flex-1"> <dl> <dt class="text-sm font-medium text-gray-500 truncate">Total Users</dt> <dd class="text-lg font-medium text-gray-900" id="totalCount">-</dd> </dl> </div> </div> </div> </div> <div class="bg-white overflow-hidden shadow rounded-lg"> <div class="p-5"> <div class="flex items-center"> <div class="flex-shrink-0"> <div class="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center"> <svg class="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20"> <path fill-rule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clip-rule="evenodd"></path> </svg> </div> </div> <div class="ml-5 w-0 flex-1"> <dl> <dt class="text-sm font-medium text-gray-500 truncate">Admins</dt> <dd class="text-lg font-medium text-gray-900" id="adminCount">-</dd> </dl> </div> </div> </div> </div> </div> <!-- Action Buttons --> <div class="bg-white shadow rounded-lg mb-8"> <div class="px-4 py-5 sm:p-6"> <h3 class="text-lg leading-6 font-medium text-gray-900 mb-4">Quick Actions</h3> <div class="flex flex-wrap gap-4"> <button id="inviteUserButton" class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"> <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20"> <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z"></path> </svg>
Invite User
</button> ${isSuper && renderTemplate`<button id="createAdminButton" class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"> <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20"> <path fill-rule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clip-rule="evenodd"></path> </svg>
Create Admin
</button>`} <button id="refreshDataButton" class="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"> <svg class="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20"> <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd"></path> </svg>
Refresh
</button> </div> </div> </div> <!-- Users Table --> <div class="bg-white shadow rounded-lg"> <div class="px-4 py-5 sm:p-6"> <div class="flex justify-between items-center mb-4"> <h3 class="text-lg leading-6 font-medium text-gray-900">User Management</h3> <div class="flex space-x-2"> <select id="statusFilter" class="border border-gray-300 rounded-md px-3 py-1 text-sm"> <option value="">All Status</option> <option value="pending">Pending</option> <option value="approved">Approved</option> <option value="suspended">Suspended</option> </select> <select id="roleFilter" class="border border-gray-300 rounded-md px-3 py-1 text-sm"> <option value="">All Roles</option> <option value="user">User</option> <option value="admin">Admin</option> <option value="super_admin">Super Admin</option> </select> </div> </div> <div class="overflow-x-auto"> <table class="min-w-full divide-y divide-gray-200"> <thead class="bg-gray-50"> <tr> <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th> <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th> <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th> <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th> <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th> </tr> </thead> <tbody id="usersTableBody" class="bg-white divide-y divide-gray-200"> <!-- Users will be loaded here --> </tbody> </table> </div> <div id="loadingMessage" class="text-center py-8 text-gray-500">
Loading users...
</div> <div id="noUsersMessage" class="text-center py-8 text-gray-500 hidden">
No users found.
</div> </div> </div> </main> <!-- Invite User Modal --> <div id="inviteModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full hidden"> <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white"> <div class="mt-3"> <h3 class="text-lg font-medium text-gray-900 mb-4">Invite New User</h3> <form id="inviteForm"> <div class="mb-4"> <label for="inviteEmail" class="block text-sm font-medium text-gray-700">Email Address</label> <input type="email" id="inviteEmail" required class="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500" placeholder="user@example.com"> </div> <div class="flex justify-end space-x-3"> <button type="button" id="cancelInvite" class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200">
Cancel
</button> <button type="submit" class="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700">
Send Invite
</button> </div> </form> </div> </div> </div> </div> ` }), defineScriptVars({ currentUserId: user?.profile?.id, isSuperAdmin: isSuper }));
}, "/home/ahmed/Documents/ksa_v3/src/pages/admin.astro", void 0);

const $$file = "/home/ahmed/Documents/ksa_v3/src/pages/admin.astro";
const $$url = "/admin";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Admin,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
