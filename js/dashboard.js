import { FULL_API_URL } from "./config.js";

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Auth Check
  const token = localStorage.getItem("access_token");

  if (!token) {
    window.location.href = "index.html";
    return;
  }

  try {
    // 2. Fetch User Profile
    const response = await fetch(`${FULL_API_URL}/users/mi-usuario`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Token inválido o expirado");
    }

    const user = await response.json();
    console.log("Usuario cargado:", user);

    // 3. Render UI based on User Data
    renderUserProfile(user);
    renderRoleBasedUI(user.role);
  } catch (error) {
    console.error("Error de sesión:", error);
    logout(); // Si falla, sacamos al usuario
  }

  // 4. Logout Handler
  document.getElementById("logoutBtn").addEventListener("click", logout);

  // 5. Navigation Handler
  document.querySelectorAll(".nav-item").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();

      // Remove active class from all
      document
        .querySelectorAll(".nav-item")
        .forEach((el) => el.classList.remove("active"));

      // Add active to clicked
      e.currentTarget.classList.add("active");

      // Load Section
      const section = e.currentTarget.dataset.section;
      loadSection(section);
    });
  });
});

function renderUserProfile(user) {
  window.currentUser = user; // Save globally for role checks
  // Top Bar & Sidebar Info
  document.getElementById("userName").innerText =
    user.full_name || user.username;

  // Safety check for user.full_name
  const firstName = user.full_name
    ? user.full_name.split(" ")[0]
    : user.username;
  document.getElementById("welcomeName").innerText = firstName;

  document.getElementById("userRole").innerText = translateRole(user.role);
  document.getElementById("userInitials").innerText = (user.full_name || "U")
    .charAt(0)
    .toUpperCase();

  // Stats
  document.getElementById("statRole").innerText = translateRole(user.role);
  // document.getElementById('statTenant').innerText = user.tenant_id ? 'Empresa Registrada' : 'Plataforma'; // Adjust this logic if needed
  // Assuming backend returns tenant info or we fetch it separately. For now, simple logic:
  document.getElementById("statTenant").innerText =
    user.role === "ADMIN" ? "Plataforma" : "Mi Empresa";
}

function renderRoleBasedUI(role) {
  // Ocultar todo primero
  document
    .querySelectorAll(".nav-section")
    .forEach((el) => el.classList.add("hidden"));

  const cleanRole = role.toUpperCase();
  if (cleanRole === "ADMIN") {
    document.getElementById("nav-admin").classList.remove("hidden");
    checkPendingPaymentsBadge(); // Init badge on load
    checkNotificationsBadge();   // Init notifications badge
  } else if (cleanRole === "COMPANY") {
    document.getElementById("nav-company").classList.remove("hidden");
    checkNotificationsBadge();   // Init notifications badge
  } else if (cleanRole === "EMPLOYEE") {
    document.getElementById("nav-employee").classList.remove("hidden");
  }
}

function translateRole(role) {
  const map = {
    ADMIN: "Administrador",
    COMPANY: "Dueño de Empresa",
    EMPLOYEE: "Empleado",
  };
  return map[role.toUpperCase()] || role;
}

function logout() {
  localStorage.removeItem("access_token");
  localStorage.removeItem("token_type");
  window.location.href = "index.html";
}

/* --- Navigation & Dynamic Content --- */

async function loadSection(section) {
  const contentDiv = document.getElementById("dynamic-content");
  const welcomePanel = document.getElementById("welcome-panel");
  const pageTitle = document.getElementById("pageTitle");

  // Clear previous dynamic content
  contentDiv.innerHTML = "";

  if (section === "welcome") {
    welcomePanel.style.display = "block";
    pageTitle.innerText = "Bienvenido";
    return;
  } else {
    welcomePanel.style.display = "none";
  }

  // Router Switch
  switch (section) {
    // ADMIN Sections
    case "tenants":
      pageTitle.innerText = "Gestión de Empresas";
      await fetchTenants(contentDiv);
      break;
    case "users":
      pageTitle.innerText = "Gestión de Usuarios";
      await fetchUsers(contentDiv);
      break;
    case "payments":
      pageTitle.innerText = "Pagos & Suscripciones";
      await fetchPayments(contentDiv);
      break;
    case "notifications":
      pageTitle.innerText = "Notificaciones";
      await fetchNotifications(contentDiv);
      break;

    // Company Sections
    case "employees":
      pageTitle.innerText = "Gestión de Empleados";
      await fetchUsers(contentDiv);
      break;
    case "subscription":
      pageTitle.innerText = "Mi Suscripción y Pagos";
      await fetchMyPayments(contentDiv);
      break;
            
    default:
      pageTitle.innerText = "En construcción";
      contentDiv.innerHTML = `<div class="empty-state"><p>La sección <strong>${section}</strong> está en desarrollo.</p></div>`;
  }
}

/* --- API Fetchers --- */

async function fetchTenants(container) {
  container.innerHTML =
    '<div class="loading-spinner"><i class="ph ph-spinner ph-spin"></i> Cargando empresas...</div>';
  try {
    const token = localStorage.getItem("access_token");
    // Removed pagination params as backend doesn't support them yet
    const response = await fetch(`${FULL_API_URL}/tenants/`, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(
        errData.detail || `Error ${response.status}: ${response.statusText}`,
      );
    }

    const tenants = await response.json();

    // Store tenants for filtering
    window.tenantsData = tenants;

    // Always show the button at the top right
    let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <input type="text" id="searchTenantName" placeholder="Buscar empresa por nombre..." style="padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; flex: 1; max-width: 300px;">
                <button class="btn-primary" onclick="openCreateTenantModal()" style="width: auto; padding: 0.5rem 1rem; font-size: 0.9rem;">
                    <i class="ph ph-plus"></i> Crear Tenant
                </button>
            </div>
        `;

    if (tenants.length === 0) {
      html += `
                <div class="empty-state">
                    <i class="ph ph-buildings"></i>
                    <p>No hay Tenants registradas.</p>
                </div>`;
    } else {
      html += '<div class="cards-grid" id="tenantsGrid">';

      tenants.forEach((t) => {
        const statusClass = t.is_active ? "status-active" : "status-inactive";
        const statusText = t.is_active ? "Activa" : "Inactiva";
        const planName = t.plan_type.replace(/_/g, " "); // Clean up enum string

        html += `
                    <div class="card tenant-card" onclick="openTenantDetailsModal('${t.id}')">
                        <div class="card-header">
                            <div class="card-icon">
                                <i class="ph ph-buildings"></i>
                            </div>
                            <div class="status-indicator ${statusClass}">
                                <span class="status-dot"></span>
                                ${statusText}
                            </div>
                        </div>
                        
                        <div class="card-body">
                            <h3 class="card-title" style="margin-bottom: 0;">${t.name}</h3>
                        </div>
                    </div>
                `;
      });

      html += "</div>"; // Close grid
    }

    container.innerHTML = html;

    // Setup search listener
    setupTenantSearch();
  } catch (e) {
    console.error("Fetch Error:", e);
    container.innerHTML = `
            <div class="error-state">
                <i class="ph ph-warning-circle"></i>
                <p>Error al cargar empresas: ${e.message}</p>
                <button class="btn-secondary" onclick="loadSection('tenants')">Reintentar</button>
            </div>`;
  }
}

function setupTenantSearch() {
  const searchInput = document.getElementById("searchTenantName");
  if (!searchInput) return;

  searchInput.addEventListener("input", (e) => {
    const searchText = e.target.value.toLowerCase();
    const grid = document.getElementById("tenantsGrid");

    if (!grid) return;

    // Filter tenants
    const filtered = window.tenantsData.filter((t) =>
      t.name.toLowerCase().includes(searchText),
    );

    // Render filtered results
    if (filtered.length === 0) {
      grid.innerHTML =
        '<div class="empty-state" style="grid-column: 1/-1;"><p>No se encontraron empresas.</p></div>';
      return;
    }

    let html = "";
    filtered.forEach((t) => {
      const statusClass = t.is_active ? "status-active" : "status-inactive";
      const statusText = t.is_active ? "Activa" : "Inactiva";

      html += `
                <div class="card tenant-card" onclick="openTenantDetailsModal('${t.id}')">
                    <div class="card-header">
                        <div class="card-icon">
                            <i class="ph ph-buildings"></i>
                        </div>
                        <div class="status-indicator ${statusClass}">
                            <span class="status-dot"></span>
                            ${statusText}
                        </div>
                    </div>
                    
                    <div class="card-body">
                        <h3 class="card-title" style="margin-bottom: 0;">${t.name}</h3>
                    </div>
                </div>
            `;
    });
    grid.innerHTML = html;
  });
}

async function fetchUsers(container) {
  container.innerHTML =
    '<div class="loading-spinner"><i class="ph ph-spinner ph-spin"></i> Cargando usuarios...</div>';
  try {
    const token = localStorage.getItem("access_token");
    const response = await fetch(`${FULL_API_URL}/users/`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    const users = await response.json();

    if (users.length === 0) {
      container.innerHTML = "<p>No hay usuarios registrados.</p>";
      return;
    }

    // Store users for filtering
    window.usersData = users;

    const isCompany =
      window.currentUser && window.currentUser.role === "COMPANY";

    let html = `
            <div style="margin-bottom: 1.5rem;">
                <div style="display: grid; grid-template-columns: ${isCompany ? "1fr 1fr auto" : "1fr 1fr 1fr auto"}; gap: 1rem; margin-bottom: 1rem;">
                    <input type="text" id="searchUserName" placeholder="Buscar por nombre..." style="padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
                    <select id="filterUserRole" style="padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; ${isCompany ? "display:none" : ""}">
                        <option value="" selected>Todos los roles</option>
                        <option value="ADMIN">Administrador</option>
                        <option value="COMPANY">Dueño de Empresa</option>
                        <option value="EMPLOYEE">Empleado</option>
                    </select>
                    <select id="filterUserStatus" style="padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
                        <option value="" selected>Todos los estados</option>
                        <option value="active">Activo</option>
                        <option value="inactive">Inactivo</option>
                    </select>
                    <button id="btnCreateUser" class="btn btn-primary" style="width: auto; padding: 0.5rem 1rem; font-size: 0.9rem;">
                        <i class="ph ph-plus"></i> Nuevo Usuario
                    </button>
                </div>
            </div>

            <div class="table-container card">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Usuario</th>
                            <th>Nombre</th>
                            ${!isCompany ? "<th>Rol</th>" : ""}
                            ${!isCompany ? "<th>Empresa</th>" : ""}
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="usersTableBody">
        `;

    renderUsersTable(users);
    html += "</tbody></table></div>";
    container.innerHTML = html;

    // Setup event listeners
    setupUserFilters();
    setupCreateUserButton();
  } catch (e) {
    console.error("Fetch Error:", e);
    container.innerHTML = `<p class="error">Error: ${e.message}</p>`;
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById("usersTableBody");
  if (!tbody) return;

  const isCompany = window.currentUser && window.currentUser.role === "COMPANY";

  let html = "";
  users.forEach((u) => {
    html += `
            <tr>
                <td>
                    <div class="user-cell">
                        <div class="avatar-sm">${(u.full_name || "U").charAt(0)}</div>
                        <div>
                            <span class="username">${u.username}</span>
                        </div>
                    </div>
                </td>
                <td>${u.full_name}</td>
                ${!isCompany ? `<td><span class="badge badge-role">${translateRole(u.role)}</span></td>` : ""}
                ${!isCompany ? `<td>${u.tenant_name || "-"}</td>` : ""}
                <td>
                    <span class="status-badge ${u.is_active ? "active" : "inactive"}">
                        ${u.is_active ? "Activo" : "Inactivo"}
                    </span>
                </td>
                <td>
                    <button class="btn-icon-sm" onclick="openUserDetailsModal('${u.id}')" title="Editar"><i class="ph ph-pencil-simple"></i></button>
                    <button class="btn-icon-sm" onclick="toggleUserStatus('${u.id}', ${u.is_active})" title="${u.is_active ? "Desactivar" : "Activar"}"><i class="ph ph-${u.is_active ? "pause" : "play"}"></i></button>
                    <button class="btn-icon-sm btn-danger" onclick="deleteUser('${u.id}')" title="Eliminar"><i class="ph ph-trash"></i></button>
                </td>
            </tr>
        `;
  });
  tbody.innerHTML = html;
}

function setupUserFilters() {
  const searchInput = document.getElementById("searchUserName");
  const roleFilter = document.getElementById("filterUserRole");
  const statusFilter = document.getElementById("filterUserStatus");

  const applyFilters = () => {
    const searchText = searchInput.value.toLowerCase();
    const selectedRole = roleFilter.value;
    const selectedStatus = statusFilter.value;

    const filtered = window.usersData.filter((u) => {
      const matchName =
        u.full_name.toLowerCase().includes(searchText) ||
        u.username.toLowerCase().includes(searchText);
      const matchRole = !selectedRole || u.role === selectedRole;
      const matchStatus =
        !selectedStatus ||
        (selectedStatus === "active" ? u.is_active : !u.is_active);
      return matchName && matchRole && matchStatus;
    });

    renderUsersTable(filtered);
  };

  if (searchInput) searchInput.addEventListener("input", applyFilters);
  if (roleFilter) roleFilter.addEventListener("change", applyFilters);
  if (statusFilter) statusFilter.addEventListener("change", applyFilters);
}

function setupCreateUserButton() {
  const btnCreate = document.getElementById("btnCreateUser");
  if (btnCreate) {
    btnCreate.addEventListener("click", openCreateUserModal);
  }
}

async function fetchPayments(container) {
  container.innerHTML =
    '<div class="loading-spinner"><i class="ph ph-spinner ph-spin"></i> Cargando pagos...</div>';
  try {
    const token = localStorage.getItem("access_token");

    // Ensure we have tenants data for mapping names
    if (!window.tenantsData) {
      const tRes = await fetch(`${FULL_API_URL}/tenants/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (tRes.ok) {
        window.tenantsData = await tRes.json();
      }
    }

    const response = await fetch(`${FULL_API_URL}/payments/pagos`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      if (response.status === 403) {
        container.innerHTML = `<div class="error-state"><p>No tienes permisos para ver pagos.</p></div>`;
        return;
      }
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    let payments = await response.json();

    // Sort Newest First
    payments.sort(
      (a, b) => new Date(b.payment_period) - new Date(a.payment_period),
    );

    window.paymentsData = payments;

    // --- Badge Logic ---
    const pendingCount = payments.filter(p => p.status === 'PENDING').length;
    const badgeElement = document.getElementById('sidebarPaymentsBadge');
    if (badgeElement) {
        if (pendingCount > 0) {
            badgeElement.classList.remove('hidden');
        } else {
            badgeElement.classList.add('hidden');
        }
    }
    // -------------------

    // Render Structure
    const isAdmin = window.currentUser && window.currentUser.role === 'ADMIN';
    
    let html = `
            <div style="margin-bottom: 2rem;">
                <!-- Filters -->
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 1rem; margin-bottom: 1rem;">
                     ${isAdmin ? `
                     <select id="filterPaymentTenant" style="padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
                        <option value="" selected>Todas las empresas</option>
                        ${window.tenantsData ? window.tenantsData.map((t) => `<option value="${t.id}">${t.name}</option>`).join("") : ""}
                    </select>
                     ` : ''}

                    <select id="filterPaymentStatus" style="padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
                        <option value="" selected>Todos los estados</option>
                        <option value="PENDING">Pendiente</option>
                        <option value="APPROVED">Aprobado</option>
                        <option value="REJECTED">Rechazado</option>
                        <option value="CANCELED">Cancelado</option>
                    </select>
                    
                    <input type="month" id="filterPaymentPeriod" style="padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
                    
                    <button class="btn btn-secondary" onclick="exportPayments()" title="Exportar a CSV">
                        <i class="ph ph-export"></i> Exportar
                    </button>
                </div>

                <div class="table-container card">
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Fecha Pago</th>
                                ${isAdmin ? '<th>Empresa</th>' : ''} 
                                <th>Periodo</th>
                                <th>Monto</th>
                                <th>Tipo</th>
                                <th>Comprobante</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody id="paymentsTableBody">
                            <!-- Rendered by JS -->
                        </tbody>
                    </table>
                </div>
            </div>
        `;

    container.innerHTML = html;
    renderPaymentsTable(payments);
    setupPaymentFilters();
  } catch (e) {
    console.error("Fetch Payments Error:", e);
    container.innerHTML = `<div class="error-state"><p>Error al cargar pagos: ${e.message}</p></div>`;
  }
}

function renderPaymentsTable(payments) {
  const tbody = document.getElementById("paymentsTableBody");
  if (!tbody) return;

  if (payments.length === 0) {
    // Find correct colspan dynamically or hardcode
    const isAdmin = window.currentUser && window.currentUser.role === 'ADMIN';
    const cols = isAdmin ? 8 : 7;
    tbody.innerHTML =
      `<tr><td colspan="${cols}" style="text-align:center; padding: 2rem;">No hay pagos registrados.</td></tr>`;
    return;
  }

  let html = "";
  const isAdmin = window.currentUser && window.currentUser.role === 'ADMIN';

  payments.forEach((p) => {
    const tenantName = window.tenantsData
      ? window.tenantsData.find((t) => t.id === p.tenant_id)?.name ||
        "Desconocida"
      : p.tenant_id;

    const dateObj = new Date(p.payment_date);
    const dateStr = dateObj.toLocaleDateString();

    const periodObj = new Date(p.payment_period);
    const periodStr = periodObj.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
    });

    const statusColors = {
      PENDING: "#f59f00",       // Amber
      APPROVED: "#2fb344",      // Green (Standard Success)
      REJECTED: "#d63939",      // Red (Standard Danger)
      CANCELED: "#ff5722",      // Red-Orange
    };
    
    // Fallback for null/undefined/empty status
    const rawStatus = p.status || "UNKNOWN";

    const statusLabel =
      {
        PENDING: "Pendiente",
        APPROVED: "Aprobado",
        REJECTED: "Rechazado",
        CANCELED: "Cancelado",
        UNKNOWN: "Sin Estado"
      }[rawStatus] || rawStatus;

    html += `
            <tr>
                <td>${dateStr}</td>
                ${isAdmin ? `<td><strong>${tenantName}</strong></td>` : ''}
                <td>${periodStr}</td>
                <td>$${p.amount.toFixed(2)}</td>
                <td>${p.type.replace("_", " ")}</td>
                <td>
                    ${p.proof_url ? `<a href="${p.proof_url}" target="_blank" style="color:var(--color-primary);" title="Ver Comprobante"><i class="ph ph-receipt" style="font-size: 1.5rem;"></i></a>` : "-"}
                </td>
                <td>
                    <span class="status-badge" style="background-color: ${statusColors[rawStatus] || "#999"}; color: white;">
                        ${statusLabel}
                    </span>
                </td>
                <td>
                    ${
                      p.status === "PENDING"
                        ? `
                        <button class="btn-icon-sm" onclick="verifyPayment('${p.id}', 'APPROVED')" title="Aprobar"><i class="ph ph-check" style="color:green;"></i></button>
                        <button class="btn-icon-sm" onclick="verifyPayment('${p.id}', 'REJECTED')" title="Rechazar"><i class="ph ph-x" style="color:red;"></i></button>
                    `
                        : ""
                    }
                </td>
            </tr>
        `;
  });
  tbody.innerHTML = html;
}

function setupPaymentFilters() {
  const tFilter = document.getElementById("filterPaymentTenant");
  const sFilter = document.getElementById("filterPaymentStatus");
  const pFilter = document.getElementById("filterPaymentPeriod");

  const filterFn = () => {
    let filtered = window.paymentsData || [];

    if (tFilter && tFilter.value) {
      filtered = filtered.filter((p) => p.tenant_id === tFilter.value);
    }
    if (sFilter && sFilter.value) {
      filtered = filtered.filter((p) => p.status === sFilter.value);
    }
    if (pFilter && pFilter.value) {
      filtered = filtered.filter((p) =>
        p.payment_period.startsWith(pFilter.value),
      );
    }

    // Store filtered data for export
    window.filteredPayments = filtered;
    renderPaymentsTable(filtered);
  };

  if (tFilter) tFilter.onchange = filterFn;
  if (sFilter) sFilter.onchange = filterFn;
  if (pFilter) pFilter.onchange = filterFn;

  // Init filtered data
  window.filteredPayments = window.paymentsData;
}

function exportPayments() {
  const dataToExport = window.filteredPayments || window.paymentsData;
  if (!dataToExport || dataToExport.length === 0) {
    showToast("No hay datos para exportar", "warning");
    return;
  }

  // CSV Header
  let csvContent = "data:text/csv;charset=utf-8,";
  csvContent +=
    "ID,Fecha Pago,Empresa,Periodo,Monto,Tipo,Estado,Comprobante URL\n";

  // CSV Rows
  dataToExport.forEach((p) => {
    const tenantName = window.tenantsData
      ? window.tenantsData.find((t) => t.id === p.tenant_id)?.name ||
        "Desconocida"
      : p.tenant_id;
    const dateStr = new Date(p.payment_date).toLocaleDateString();

    csvContent += `${p.id},${dateStr},"${tenantName}",${p.payment_period},${p.amount},${p.type},${p.status},${p.proof_url || ""}\n`;
  });

  // Download Trigger
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "pagos_negociapp.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/* --- Notifications Logic replaced by newer version below --- */

/* --- Modal & Form Logic --- */

function openModal() {
  document.getElementById("modalCreateTenant").classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modalCreateTenant").classList.add("hidden");
  document.getElementById("formCreateTenant").reset();
}

// Bind Global Window Functions for inline onclicks
window.openCreateTenantModal = openModal;

// Event Listeners for Modal
document.addEventListener("DOMContentLoaded", () => {
  // Other init code...

  const modal = document.getElementById("modalCreateTenant");
  if (modal) {
    // Close on X
    modal
      .querySelector(".btn-close-modal")
      .addEventListener("click", closeModal);
    // Close on Cancel
    modal
      .querySelector(".btn-cancel-modal")
      .addEventListener("click", closeModal);
    // Close on Click Outside
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });

    // Form Submit
    document
      .getElementById("formCreateTenant")
      .addEventListener("submit", handleCreateTenant);
  }
});

/* --- Toast Notification Logic --- */
function showToast(message, type = "success") {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerText = message;

  container.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add("show");
  });

  // Remove after 3 seconds (User asked for 1s but that's very short for reading,
  // I'll set it to 3s for better UX, or strictly 1s if they insist?
  // User asked "que dure 1 segundo". usage: setTimeout 1000)
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      if (container.contains(toast)) {
        container.removeChild(toast);
      }
    }, 300); // Wait for transition out
  }, 1000); // 1 second duration as requested
}

async function handleCreateTenant(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const originalText = btn.innerText;
  btn.disabled = true;
  btn.innerText = "Creando...";

  const formData = new FormData(e.target);

  // Construct Payload
  // Backend expects specific structure:
  // { "tenant_data": {...}, "company_role_data": {...} }

  const payload = {
    tenant_data: {
      name: formData.get("name"),
      contact_email: formData.get("contact_email"),
      contact_name: formData.get("contact_name"),
      phone_number: formData.get("phone_number_suffix")
        ? `+54 9 ${formData.get("phone_number_suffix")}`
        : null,
      plan_type: formData.get("plan_type"), // From Select Input
    },
    company_role_data: {
      username: formData.get("username"),
      full_name: formData.get("full_name"),
      password: formData.get("password"),
      tenant_id: "00000000-0000-0000-0000-000000000000", // Dummy UUID
    },
  };

  try {
    const token = localStorage.getItem("access_token");
    const response = await fetch(`${FULL_API_URL}/tenants/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      // Improved error formatting
      let errorMsg = "Error al crear la empresa";
      if (errData.detail) {
        if (typeof errData.detail === "string") {
          errorMsg = errData.detail;
        } else if (Array.isArray(errData.detail)) {
          errorMsg = errData.detail
            .map((e) => `${e.loc.join(".")}: ${e.msg}`)
            .join("\n");
        } else {
          errorMsg = JSON.stringify(errData.detail);
        }
      }
      throw new Error(errorMsg);
    }

    const newTenant = await response.json();
    showToast(`Empresa "${newTenant.name}" creada exitosamente.`); // Toast instead of alert
    closeModal();

    // Refresh List
    const contentDiv = document.getElementById("dynamic-content");
    await fetchTenants(contentDiv);
  } catch (error) {
    console.error(error);
    showToast(error.message, "error"); // Toast for error too
  } finally {
    btn.disabled = false;
    btn.innerText = originalText;
  }
}

/* --- Tenant Details Modal Logic --- */

let currentTenantId = null; // Store ID for actions

async function openTenantDetailsModal(tenantId) {
  currentTenantId = tenantId;
  const modal = document.getElementById("modalTenantDetails");
  const modalContent = document.getElementById("tenantModalContent");

  modal.classList.remove("hidden");
  modalContent.innerHTML = '<p style="padding: 2rem;">Cargando datos...</p>';

  try {
    const token = localStorage.getItem("access_token");
    const response = await fetch(`${FULL_API_URL}/tenants/${tenantId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) throw new Error("Error al obtener detalles");

    const tenant = await response.json();

    // Plan Options
    const planOptions = [
      { value: "FREE_FOREVER", label: "Free Forever" },
      { value: "FREE_TRIAL_1_MONTH", label: "Prueba Gratis (1 Mes)" },
      { value: "PAID_MONTHLY", label: "Pago Mensual" },
      { value: "PAID_YEARLY", label: "Pago Anual" },
    ];

    const planSelectHtml = planOptions
      .map(
        (p) =>
          `<option value="${p.value}" ${tenant.plan_type === p.value ? "selected" : ""}>${p.label}</option>`,
      )
      .join("");

    // Render Full Vertical Layout
    modalContent.innerHTML = `
            <div class="tenant-modal-header">
                <button class="btn-close-modal-clean" id="btnCloseTenantModal">&times;</button>
            </div>
            
            <div class="tenant-modal-body">
                <div class="tenant-modal-layout">
                    <!-- 1. Form Section (Full Width) -->
                    <div class="tenant-form-col">
                        <form id="formTenantDetails" style="display:contents;">
                            <div class="tenant-field-row">
                                <label>Nombre de empresa</label>
                                <input type="text" name="name" value="${tenant.name}" disabled class="editable-input">
                            </div>
                            <div class="tenant-field-row">
                                <label>Contacto</label>
                                <input type="text" name="contact_name" value="${tenant.contact_name}" disabled class="editable-input">
                            </div>
                            <div class="tenant-field-row">
                                <label>Email de Contacto</label>
                                <input type="email" name="contact_email" value="${tenant.contact_email}" disabled class="editable-input">
                            </div>
                            <div class="tenant-field-row">
                                <label>Teléfono de Contacto</label>
                                <input type="tel" name="phone_number" value="${tenant.phone_number || ""}" disabled class="editable-input">
                            </div>
                            <div class="tenant-field-row">
                                <label>Plan:</label>
                                <select name="plan_type" disabled class="editable-input">
                                    ${planSelectHtml}
                                </select>
                            </div>
                            <div class="tenant-field-row">
                                <label>Fin de Suscripción:</label>
                                <input type="text" name="subscription_end" value="${tenant.subscription_end || "N/A"}" disabled class="editable-input">
                            </div>
                        </form>
                    </div>

                    <!-- 2. Users Section (Accordion Style) -->
                    <div class="users-section-bar" id="btnToggleUsers">
                        Ver Usuarios <i class="ph ph-caret-down"></i>
                    </div>
                    <div class="users-list-container hidden" id="tenantUsersList">
                        Cargando usuarios...
                    </div>

                    <!-- 3. Actions Footer (Bottom) -->
                    <div class="tenant-actions-footer">
                        <!-- Switch / Toggle -->
                        <div class="status-toggle-group">
                            <!-- Toggle buttons managed via JS styles -->
                             <div class="status-toggle-option" id="optActivo">Activo</div>
                             <div class="status-toggle-option" id="optInactivo">Inactivo</div>
                        </div>

                        <!-- Modify / Delete Buttons -->
                        <div class="action-buttons-group">
                            <button id="btnModifyTenant" class="btn btn-success">Modificar</button>
                            <button id="btnDeleteTenant" class="btn btn-danger-bright">Eliminar</button>
                        </div>
                    </div>

                </div>
            </div>
        `;

    // --- Logic Implementation ---

    // 1. Status Toggle Visuals
    const optActivo = document.getElementById("optActivo");
    const optInactivo = document.getElementById("optInactivo");

    const updateToggleVisuals = (isActive) => {
      if (isActive) {
        // Active State: "Activo" is Selected (Black), "Inactivo" is unselected (White)
        optActivo.classList.add("selected-black");
        optInactivo.classList.remove("selected-black");
      } else {
        // Inactive State: "Inactivo" is Selected (Black), "Activo" is unselected (White)
        optActivo.classList.remove("selected-black");
        optInactivo.classList.add("selected-black");
      }
    };
    updateToggleVisuals(tenant.is_active);

    // Bind Status Change
    window.handleStatusToggle = async (setActive) => {
      if (setActive === tenant.is_active) return; // No change

      const action = setActive ? "activar" : "desactivar";
      try {
        const res = await fetch(
          `${FULL_API_URL}/tenants/${action}/${tenantId}`,
          {
            method: "PATCH",
            headers: { Authorization: `Bearer ${token}` },
          },
        );
        if (!res.ok) throw new Error("Error al cambiar estado");

        showToast(`Empresa ${setActive ? "activada" : "desactivada"}.`);
        // Reload modal to reflect new state
        openTenantDetailsModal(tenantId);
        // Refresh grid
        fetchTenants(document.getElementById("dynamic-content"));
      } catch (e) {
        showToast(e.message, "error");
      }
    };

    optActivo.onclick = () => window.handleStatusToggle(true);
    optInactivo.onclick = () => window.handleStatusToggle(false);

    // 2. Bind Close Event
    document.getElementById("btnCloseTenantModal").onclick = () => {
      modal.classList.add("hidden");
    };

    // 3. Setup Users List Toggle
    const usersListDiv = document.getElementById("tenantUsersList");
    document.getElementById("btnToggleUsers").onclick = () => {
      const isHidden = usersListDiv.classList.toggle("hidden");
      const icon = document.querySelector("#btnToggleUsers i");
      if (icon)
        icon.className = isHidden ? "ph ph-caret-down" : "ph ph-caret-up";

      if (!isHidden) {
        fetchTenantUsers(tenantId, usersListDiv);
      }
    };

    // 4. Setup Action Buttons
    setupDynamicActionButtons(tenantId, token);
  } catch (error) {
    console.error(error);
    modalContent.innerHTML = `<div class="error"><p>${error.message}</p><button class="btn-secondary" onclick="document.getElementById('modalTenantDetails').classList.add('hidden')">Cerrar</button></div>`;
  }
}

/* --- Setup Listeners for New Modal --- */
// Old listeners removed - handled dynamically in openTenantDetailsModal

// --- Moved Listeners Logic to centralized function to handle state reset ---

function setupDynamicActionButtons(tenantId, token) {
  const btnModify = document.getElementById("btnModifyTenant");
  const btnDelete = document.getElementById("btnDeleteTenant");
  let isEditing = false;

  // MODIFY / SAVE
  btnModify.onclick = async () => {
    const inputs = document.querySelectorAll(".editable-input");

    if (!isEditing) {
      // ENTER EDIT
      isEditing = true;
      inputs.forEach((input) => {
        input.disabled = false;
        input.style.backgroundColor = "white";
        input.style.borderColor = "var(--color-primary)";
      });
      btnModify.innerText = "Guardar";
    } else {
      // SAVE
      const form = document.getElementById("formTenantDetails");
      const formData = new FormData(form);
      const payload = {
        name: formData.get("name"),
        contact_name: formData.get("contact_name"),
        contact_email: formData.get("contact_email"),
        phone_number: formData.get("phone_number") || null,
        plan_type: formData.get("plan_type"), // New field
      };

      try {
        btnModify.innerText = "Guardando...";
        const res = await fetch(`${FULL_API_URL}/tenants/${tenantId}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error("Error al actualizar");

        showToast("Datos actualizados");
        openTenantDetailsModal(tenantId); // Reload
        fetchTenants(document.getElementById("dynamic-content"));
      } catch (e) {
        showToast(e.message, "error");
        btnModify.innerText = "Guardar";
      }
    }
  };

  // DELETE
  btnDelete.onclick = async () => {
    showConfirmationModal(
      "Eliminar Empresa",
      "¿Estás seguro de que deseas eliminar esta empresa? Esta acción no se puede deshacer.",
      async () => {
        try {
          const res = await fetch(`${FULL_API_URL}/tenants/${tenantId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) throw new Error("Error al eliminar");

          showToast("Empresa eliminada.");
          document.getElementById("modalTenantDetails").classList.add("hidden");
          fetchTenants(document.getElementById("dynamic-content"));
        } catch (err) {
          showToast(err.message, "error");
        }
      },
    );
  };
}

async function fetchTenantUsers(tenantId, container) {
  container.innerHTML = "Cargando...";
  try {
    const token = localStorage.getItem("access_token");
    const response = await fetch(`${FULL_API_URL}/users/tenant/${tenantId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const users = await response.json();

    if (users.length === 0) {
      container.innerHTML = '<p style="padding:1rem;">No hay usuarios.</p>';
      return;
    }

    let html = '<div style="background:#fafafa; padding: 0.5rem 1rem;">';
    // Header
    html +=
      '<div style="display:grid; grid-template-columns: 2fr 1fr 1fr 1fr; font-weight:bold; padding-bottom:0.5rem; border-bottom:1px solid #ddd; color: var(--color-dark);"><span>Nombre</span><span>Usuario</span><span>Rol</span><span>Estado</span></div>';

    // Rows
    users.forEach((u) => {
      const statusTxt = u.is_active ? "ACTIVO" : "INACTIVO";
      const statusColor = u.is_active
        ? "var(--success-color)"
        : "var(--danger-color)";

      html += `
                <div class="user-row-simple" style="display:grid; grid-template-columns: 2fr 1fr 1fr 1fr; padding: 0.5rem 0; border-bottom: 1px dashed #eee; align-items: center;">
                    <span style="font-weight:500;">${u.full_name || "-"}</span>
                    <span style="color: var(--text-muted); font-size: 0.9em;">${u.username}</span>
                    <span>${u.role}</span>
                    <span style="color:${statusColor}; font-weight:bold; font-size: 0.85em;">${statusTxt}</span>
                </div>
             `;
    });
    html += "</div>";

    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = "Error cargando usuarios.";
  }
}

/* --- Confirmation Modal --- */
function showConfirmationModal(title, message, onConfirm, confirmType = 'danger') {
  const modal = document.getElementById("confirmationModal");
  const titleEl = document.getElementById("confirmationTitle");
  const messageEl = document.getElementById("confirmationMessage");
  const btnCancel = document.getElementById("btnCancelConfirmation");
  const btnConfirm = document.getElementById("btnConfirmAction");

  titleEl.innerText = title;
  messageEl.innerText = message;

  // Determine Class
  btnConfirm.className = 'btn'; // Reset to base class
  
  if (confirmType === 'success') {
      // Use explicit green for success/approval
      btnConfirm.style.backgroundColor = '#2fb344'; 
      btnConfirm.style.color = 'white';
      btnConfirm.style.border = 'none'; // Ensure no border conflict
  } else {
      // Default Danger Style
      btnConfirm.classList.add('btn-danger-bright');
      btnConfirm.style.backgroundColor = ''; 
      btnConfirm.style.color = '';
      btnConfirm.style.border = '';
  }

  modal.classList.remove("hidden");

  btnCancel.onclick = () => {
    modal.classList.add("hidden");
  };

  btnConfirm.onclick = async () => {
    modal.classList.add("hidden");
    await onConfirm();
  };
}

/* --- User Management Functions --- */
async function toggleUserStatus(userId, currentStatus) {
  const token = localStorage.getItem("access_token");
  const newStatus = !currentStatus;
  const action = newStatus ? "activar" : "desactivar";

  try {
    const res = await fetch(`${FULL_API_URL}/users/${action}/${userId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Error al cambiar estado");

    showToast(`Usuario ${newStatus ? "activado" : "desactivado"}.`);
    fetchUsers(document.getElementById("dynamic-content"));
  } catch (e) {
    showToast(e.message, "error");
  }
}

async function deleteUser(userId) {
  const token = localStorage.getItem("access_token");

  showConfirmationModal(
    "Eliminar Usuario",
    "¿Estás seguro de que deseas eliminar este usuario? Esta acción no se puede deshacer.",
    async () => {
      try {
        const res = await fetch(`${FULL_API_URL}/users/${userId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Error al eliminar");

        showToast("Usuario eliminado.");
        fetchUsers(document.getElementById("dynamic-content"));
      } catch (e) {
        showToast(e.message, "error");
      }
    },
  );
}

async function openUserDetailsModal(userId) {
  const token = localStorage.getItem("access_token");
  const modal = document.getElementById("confirmationModal"); // Reutilizamos estructura similar

  try {
    const res = await fetch(`${FULL_API_URL}/users/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error("Error al obtener usuario");

    const user = await res.json();

    // Crear un modal simple de edición
    const editModal = document.createElement("div");
    editModal.className = "modal";
    editModal.id = "userEditModal";
    editModal.innerHTML = `
            <div class="modal-content confirmation-modal-content">
                <div class="confirmation-modal-header">
                    <h2>Editar Usuario</h2>
                </div>
                <div class="confirmation-modal-body" style="text-align: left;">
                    <form id="formEditUser" style="display: flex; flex-direction: column; gap: 1rem;">
                        <div>
                            <label>Usuario</label>
                            <input type="text" value="${user.username}" disabled style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px; background-color: #f5f5f5; color: #666;">
                        </div>
                        <div>
                            <label>Nombre Completo</label>
                            <input type="text" name="full_name" value="${user.full_name}" style="width: 100%; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
                        </div>
                        <input type="hidden" name="role" value="${user.role}"> 
                    </form>
                </div>
                <div class="confirmation-modal-footer">
                    <button class="btn btn-secondary" onclick="document.getElementById('userEditModal').remove()">Cancelar</button>
                    <button class="btn btn-primary" onclick="saveUserChanges('${userId}')">Guardar</button>
                </div>
            </div>
        `;

    document.body.appendChild(editModal);
  } catch (e) {
    showToast(e.message, "error");
  }
}

async function saveUserChanges(userId) {
  const token = localStorage.getItem("access_token");
  const form = document.getElementById("formEditUser");
  const formData = new FormData(form);

  try {
    const res = await fetch(`${FULL_API_URL}/users/${userId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        full_name: formData.get("full_name"),
        role: formData.get("role"),
      }),
    });

    if (!res.ok) throw new Error("Error al actualizar usuario");

    showToast("Usuario actualizado.");
    document.getElementById("userEditModal").remove();
    fetchUsers(document.getElementById("dynamic-content"));
  } catch (e) {
    showToast(e.message, "error");
  }
}

async function openCreateUserModal() {
  const token = localStorage.getItem("access_token");
  const isCompany = window.currentUser && window.currentUser.role === "COMPANY";

  try {
    let tenantOptions = "";

    if (!isCompany) {
      // Fetch tenants for dropdown only if ADMIN
      const tenantsRes = await fetch(`${FULL_API_URL}/tenants/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const tenants = await tenantsRes.json();

      tenantOptions = '<option value="">Seleccionar empresa</option>';
      tenants.forEach((t) => {
        tenantOptions += `<option value="${t.id}">${t.name}</option>`;
      });
    }

    const editModal = document.createElement("div");
    editModal.className = "modal";
    editModal.id = "userCreateModal";

    // Adjust Role Options based on creator
    let roleOptions = "";
    if (isCompany) {
      roleOptions = `
                <option value="EMPLOYEE" selected>Empleado</option>
            `;
    } else {
      roleOptions = `
                <option value="">Seleccionar rol</option>
                <option value="ADMIN">Administrador</option>
                <option value="COMPANY">Dueño de Empresa</option>
                <option value="EMPLOYEE">Empleado</option>
            `;
    }

    const tenantSelectHtml = isCompany
      ? `<input type="hidden" name="tenant_id" value="${window.currentUser.tenant_id}">`
      : `
                <div class="tenant-field-row">
                    <label>Empresa</label>
                    <select name="tenant_id" class="editable-input">
                        ${tenantOptions}
                    </select>
                </div>
            `;

    editModal.innerHTML = `
            <div class="modal-content confirmation-modal-content">
                <div class="confirmation-modal-header">
                    <h2>Crear Nuevo Usuario</h2>
                </div>
                <div class="confirmation-modal-body" style="text-align: left;">
                    <form id="formCreateNewUser">
                        <div class="tenant-field-row">
                            <label>Nombre Completo</label>
                            <input type="text" name="full_name" required class="editable-input">
                        </div>
                        <div class="tenant-field-row">
                            <label>Usuario</label>
                            <input type="text" name="username" required class="editable-input">
                        </div>
                        <div class="tenant-field-row">
                            <label>Contraseña</label>
                            <input type="password" name="password" required class="editable-input">
                        </div>
                        <div class="tenant-field-row">
                            <label>Rol</label>
                            <select name="role" required class="editable-input">
                                ${roleOptions}
                            </select>
                        </div>
                        ${tenantSelectHtml}
                    </form>
                </div>
                <div class="confirmation-modal-footer">
                    <button class="btn btn-secondary" onclick="document.getElementById('userCreateModal').remove()">Cancelar</button>
                    <button class="btn btn-primary" onclick="createNewUser()">Crear</button>
                </div>
            </div>
        `;

    document.body.appendChild(editModal);
  } catch (e) {
    showToast("Error al cargar empresas: " + e.message, "error");
  }
}

async function createNewUser() {
  const token = localStorage.getItem("access_token");
  const form = document.getElementById("formCreateNewUser");
  const formData = new FormData(form);

  try {
    const tenantId = formData.get("tenant_id");
    const payload = {
      full_name: formData.get("full_name"),
      username: formData.get("username"),
      password: formData.get("password"),
      role: formData.get("role"),
    };

    // Solo agregar tenant_id si está seleccionado
    if (tenantId) {
      payload.tenant_id = tenantId;
    }

    const res = await fetch(`${FULL_API_URL}/users/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error("Error al crear usuario");

    showToast("Usuario creado exitosamente.");
    document.getElementById("userCreateModal").remove();
    fetchUsers(document.getElementById("dynamic-content"));
  } catch (e) {
    showToast(e.message, "error");
  }
}

// Explicitly bind to window to ensure HTML onclick can see it
window.openTenantDetailsModal = openTenantDetailsModal;
window.toggleUserStatus = toggleUserStatus;
window.deleteUser = deleteUser;
window.openUserDetailsModal = openUserDetailsModal;
window.saveUserChanges = saveUserChanges;
window.openCreateUserModal = openCreateUserModal;
window.closePaymentModal = closePaymentModal;
window.openPaymentModal = openPaymentModal;
window.cancelPayment = cancelPayment;
window.verifyPayment = verifyPayment;


async function verifyPayment(paymentId, newStatus) {
    const actionLabel = newStatus === 'APPROVED' ? 'aprobar' : 'rechazar';
    const confirmType = newStatus === 'APPROVED' ? 'success' : 'danger';
    
    showConfirmationModal(
        `Confirmar ${newStatus === 'APPROVED' ? 'Aprobación' : 'Rechazo'}`,
        `¿Estás seguro de que deseas ${actionLabel} este pago?`,
        async () => {
             const token = localStorage.getItem('access_token');
            try {
                // Backend expects Form data for 'status'
                const formData = new FormData();
                formData.append('status', newStatus);

                const res = await fetch(`${FULL_API_URL}/payments/${paymentId}`, {
                    method: 'PATCH',
                    headers: { 
                        'Authorization': `Bearer ${token}` 
                        // Content-Type: multipart/form-data (browser sets it automatically with boundary)
                    },
                    body: formData
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.detail || 'Error al actualizar estado del pago');
                }

                showToast(`Pago ${newStatus === 'APPROVED' ? 'aprobado' : 'rechazado'} correctamente.`);
                // Reload payments list (assuming we are in Admin view if verifyPayment is called)
                fetchPayments(document.getElementById('dynamic-content'));

            } catch(e) {
                showToast(e.message, 'error');
            }
        },
        confirmType
    );
}


/* --- Subscription & Payments Logic (Company) --- */

async function fetchMyPayments(container) {
    container.innerHTML = '<div class="loading-spinner"><i class="ph ph-spinner ph-spin"></i> Cargando mis pagos...</div>';
    
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`${FULL_API_URL}/payments/mis-pagos`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Error al cargar pagos');
        
        let payments = await response.json();
        
        // Sort newest first
        payments.sort((a, b) => new Date(b.created_at || b.payment_period) - new Date(a.created_at || a.payment_period));

        let html = `
            <div class="dashboard-header-actions" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem;">
                <div>
                     <h3>Historial de Pagos</h3>
                     <p style="color:var(--text-muted); font-size:0.9rem;">Gestiona tus comprobantes y estado de cuenta</p>
                </div>
                <button class="btn btn-primary" onclick="openPaymentModal()">
                    <i class="ph ph-plus-circle"></i> Registrar Pago
                </button>
            </div>

            <div class="table-container card">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Fecha Registro</th>
                            <th>Periodo</th>
                            <th>Monto</th>
                            <th>Tipo</th>
                            <th>Estado</th>
                            <th>Comprobante</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        if (payments.length === 0) {
            html += '<tr><td colspan="7" style="text-align:center; padding:2rem;">No hay pagos registrados.</td></tr>';
        } else {
            payments.forEach(p => {
                const dateReg = new Date(p.created_at || new Date()).toLocaleDateString(); // Fallback if created_at missing using today (should be there)
                const period = new Date(p.payment_period).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
                const typeLabel = p.type.replace('_', ' ');
                
                const statusColors = {
                    'PENDING': 'orange',
                    'APPROVED': 'var(--success-color)',
                    'REJECTED': 'var(--danger-color)',
                    'CANCELED': 'gray'
                };
                const statusLabel = {
                    'PENDING': 'Pendiente',
                    'APPROVED': 'Aprobado',
                    'REJECTED': 'Rechazado',
                    'CANCELED': 'Cancelado'
                }[p.status] || p.status;

                html += `
                    <tr>
                        <td>${dateReg}</td>
                        <td style="text-transform:capitalize;">${period}</td>
                        <td>$${p.amount.toFixed(2)}</td>
                        <td>${typeLabel}</td>
                        <td><span class="status-badge" style="background-color:${statusColors[p.status]}; color:white;">${statusLabel}</span></td>
                        <td>
                            ${p.proof_url ? `<a href="${p.proof_url}" target="_blank" style="color:var(--color-primary);" title="Ver Comprobante"><i class="ph ph-receipt" style="font-size: 1.5rem;"></i></a>` : '-'}
                        </td>
                        <td>
                            ${p.status === 'PENDING' ? 
                                `<button class="btn-icon-sm btn-danger" onclick="cancelPayment('${p.id}')" title="Cancelar Pago"><i class="ph ph-x-circle"></i></button>` 
                                : '<span style="color:#ccc;">-</span>'
                            }
                        </td>
                    </tr>
                `;
            });
        }

        html += '</tbody></table></div>';
        container.innerHTML = html;

    } catch(e) {
        console.error(e);
        container.innerHTML = `<div class="error-state"><p>Error: ${e.message}</p></div>`;
    }
}

async function fetchNotifications(container) {
    container.innerHTML = '<div class="loading-spinner"><i class="ph ph-spinner ph-spin"></i> Cargando...</div>';
    
    try {
        const token = localStorage.getItem('access_token');
        const role = window.currentUser ? window.currentUser.role : null;
        const isAdmin = role === 'ADMIN';

        // Filters (Company only for Admin)
        const filtersHtml = `
            <div style="display: flex; gap: 1rem; margin-bottom: 1rem;">
                ${isAdmin ? `
                <select id="filterNotifTenant" onchange="applyNotifFilters()" style="padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
                    <option value="" selected>Todas las Empresas</option>
                    ${window.tenantsData ? window.tenantsData.map(t => `<option value="${t.id}">${t.name}</option>`).join('') : ''}
                </select>
                ` : ''}

                <select id="filterNotifStatus" onchange="applyNotifFilters()" style="padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;">
                    <option value="" selected>Todos los estados</option>
                    <option value="PENDING">Pendiente</option>
                    <option value="RESOLVED">Resuelto</option>
                    <option value="IGNORED">Ignorado</option>
                </select>
            </div>
        `;

        const res = await fetch(`${FULL_API_URL}/notifications/`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error("Error al obtener notificaciones");

        let notifications = await res.json();
        
        // Sort by Date Desc
        notifications.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
        
        window.notificationsData = notifications; // Store for filtering

        let html = `
            <h2>Notificaciones</h2>
            ${filtersHtml}
            <div class="table-container card">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            ${isAdmin ? '<th>Empresa</th>' : ''}
                            <th>Tipo</th>
                            <th>Estado</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody id="notifTableBody">
        `;
        
        html += renderNotificationsRows(notifications, isAdmin);
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        container.innerHTML = html;
        
        window.applyNotifFilters = () => {
            const tFilter = document.getElementById('filterNotifTenant');
            const sFilter = document.getElementById('filterNotifStatus');
            
            let filtered = window.notificationsData;
            
            if (tFilter && tFilter.value) {
                filtered = filtered.filter(n => n.tenant_id === tFilter.value);
            }
            if (sFilter && sFilter.value) {
                filtered = filtered.filter(n => n.status === sFilter.value);
            }
            
            document.getElementById('notifTableBody').innerHTML = renderNotificationsRows(filtered, isAdmin);
        };

    } catch (e) {
        console.error(e);
        container.innerHTML = `<div class="error-state"><p>${e.message}</p></div>`;
    }
}

function renderNotificationsRows(list, isAdmin) {
    if (list.length === 0) {
        const cols = isAdmin ? 5 : 4;
        return `<tr><td colspan="${cols}" style="text-align: center; padding: 2rem;">No hay notificaciones.</td></tr>`;
    }
    
    return list.map(n => {
        const dateStr = new Date(n.created_at).toLocaleDateString() + ' ' + new Date(n.created_at).toLocaleTimeString();
        
        const typeMap = {
            'RESET_PASSWORD_REQUEST': 'Recuperar Contraseña'
        };
        const typeLabel = typeMap[n.type] || n.type;
        
        const statusColors = {
            'PENDING': '#f59f00',   // Amber
            'RESOLVED': '#2fb344',  // Green
            'IGNORED': '#d63939'    // Red
        };
        const statusLabel = {
            'PENDING': 'Pendiente',
            'RESOLVED': 'Resuelto',
            'IGNORED': 'Ignorado'
        }[n.status] || n.status;
        
        let actions = '-';
        if (n.status === 'PENDING' && n.type === 'RESET_PASSWORD_REQUEST') {
             actions = `
                <button class="btn btn-primary" style="background-color: #2fb344 !important; border-color: #2fb344 !important; padding: 0.5rem 1rem;" onclick="openResolvePasswordModal('${n.id}', '${n.user_id}')" title="Resolver (Cambiar Contraseña)">
                    <i class="ph ph-check" style="font-size: 1.2rem; margin-right: 0.5rem;"></i> Resolver
                </button>
                <button class="btn btn-danger" onclick="resolveNotification('${n.id}', 'IGNORED')" title="Cancelar" style="padding: 0.5rem 1rem; margin-left: 0.5rem;">
                    <i class="ph ph-x" style="font-size: 1.2rem; margin-right: 0.5rem;"></i> Cancelar
                </button>
             `;
        }
        
        const tenantName = window.tenantsData 
            ? (window.tenantsData.find(t => t.id === n.tenant_id)?.name || '...') 
            : '...';

        return `
            <tr>
                <td>${dateStr}</td>
                ${isAdmin ? `<td><strong>${tenantName}</strong></td>` : ''}
                <td>${typeLabel}</td>
                <td>
                    <span class="status-badge" style="background-color: ${statusColors[n.status] || '#999'}; color: white;">
                        ${statusLabel}
                    </span>
                </td>
                <td>${actions}</td>
            </tr>
        `;
    }).join('');
}

async function resolveNotification(id, newStatus) {
    if (!confirm('¿Estás seguro de cambiar el estado de esta notificación?')) return;

    try {
        const token = localStorage.getItem('access_token');
        const res = await fetch(`${FULL_API_URL}/notifications/${id}?new_Status=${newStatus}`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Error al actualizar notificación');
        }

        showToast('Notificación actualizada');
        fetchNotifications(document.getElementById('dynamic-content'));
        checkNotificationsBadge(); 
        
    } catch (e) {
        showToast(e.message, 'error');
    }
}

async function openPaymentModal() {
    const modal = document.getElementById('modalCreatePayment');
    const typeSelect = document.getElementById('paymentType');
    
    // Show spinner or disable while loading?
    typeSelect.disabled = true;

    try {
        const token = localStorage.getItem('access_token');
        const res = await fetch(`${FULL_API_URL}/tenants/mi-empresa`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
            const tenant = await res.json();
            // Logic per user request:
            // FREE_TRIAL_1_MONTH -> PAGO_MENSUAL (Defaulting to monthly as next step)
            // FREE_FOREVER -> PAGO_MENSUAL
            // PAID_MONTHLY -> PAGO_MENSUAL
            // PAID_YEARLY -> PAGO_ANUAL
            
            let targetType = 'PAGO_MENSUAL';
            if (tenant.plan_type === 'PAID_YEARLY') {
                targetType = 'PAGO_ANUAL';
            }
            
            typeSelect.value = targetType;
            
            // Add visual cue
            const existingHint = document.getElementById('paymentTypeHint');
            if (existingHint) existingHint.remove();
            
            const hint = document.createElement('small');
            hint.id = 'paymentTypeHint';
            hint.style.color = 'var(--text-muted)';
            hint.innerText = `Fijo según tu plan actual (${tenant.plan_type.replace(/_/g, ' ')})`;
            typeSelect.parentNode.appendChild(hint);
        }
    } catch (e) {
        console.error("Could not fetch tenant plan", e);
    } finally {
        typeSelect.disabled = true; // Keep disabled as requested "opcion fija"
        modal.classList.remove('hidden');
    }
}

function closePaymentModal() {
    document.getElementById('modalCreatePayment').classList.add('hidden');
    document.getElementById('formCreatePayment').reset();
}

async function cancelPayment(paymentId) {
    if (!confirm('¿Estás seguro de que deseas cancelar este pago pendiente?')) return;
    
    const token = localStorage.getItem('access_token');
    try {
        const res = await fetch(`${FULL_API_URL}/payments/cancelar/${paymentId}`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!res.ok) {
             const err = await res.json();
             throw new Error(err.detail || 'Error al cancelar');
        }
        
        showToast('Pago cancelado correctamente');
        fetchMyPayments(document.getElementById('dynamic-content'));
    } catch(e) {
        showToast(e.message, 'error');
    }
}

// Bind Form Submit
document.addEventListener('DOMContentLoaded', () => {
   const formPay = document.getElementById('formCreatePayment');
   if (formPay) {
       formPay.addEventListener('submit', async (e) => {
           e.preventDefault();
           const btn = formPay.querySelector('button[type="submit"]');
           const originalText = btn.innerText;
           btn.innerText = "Enviando...";
           btn.disabled = true;

           // Calculate type from disabled select (formData ignores disabled inputs usually)
           const typeSelect = document.getElementById('paymentType');

           try {
               const formData = new FormData(formPay);
               // Re-add type manually if disabled
               if (!formData.has('type')) {
                   formData.append('type', typeSelect.value);
               }
               
               // Validate File Size (5MB)
               const fileInput = document.getElementById('paymentFile');
               if (fileInput.files.length > 0) {
                   const fileSize = fileInput.files[0].size;
                   const maxSize = 5 * 1024 * 1024; // 5MB
                   if (fileSize > maxSize) {
                       throw new Error('El archivo supera los 5MB permitidos.');
                   }
               }
               
               const token = localStorage.getItem('access_token');
               
               // Fix Date for Month input (YYYY-MM -> YYYY-MM-01)
               const rawPeriod = formData.get('payment_period');
               if (rawPeriod && rawPeriod.length === 7) {
                   formData.set('payment_period', rawPeriod + '-01');
               }

               // Endpoint expects form-data
               const res = await fetch(`${FULL_API_URL}/payments/`, {
                   method: 'POST',
                   headers: {
                       'Authorization': `Bearer ${token}`
                       // Content-Type not set for FormData, browser sets boundary
                   },
                   body: formData
               });

               if (!res.ok) {
                   const err = await res.json();
                   throw new Error(err.detail || 'Error al registrar pago');
               }

               showToast('Pago registrado exitosamente');
               closePaymentModal();
               fetchMyPayments(document.getElementById('dynamic-content'));

           } catch(e) {
               showToast(e.message, 'error');
           } finally {
               btn.innerText = originalText;
               btn.disabled = false;
           }
       });
   }
   
   // Form Change Password Bind
    const formPass = document.getElementById('formChangePassword');
    if (formPass) {
        formPass.addEventListener('submit', handleChangePassword);
    }
});

/* --- User Profile & Password Change --- */

async function openUserProfileModal() {
    const modal = document.getElementById('modalUserProfile');
    
    // Reset View
    togglePasswordForm(false);
    document.getElementById('formChangePassword').reset();

    // Elements
    const fullNameEl = document.getElementById('profileFullName');
    const usernameEl = document.getElementById('profileUsername');
    const roleEl = document.getElementById('profileRole');
    const tenantRow = document.getElementById('profileTenantRow');
    const tenantEl = document.getElementById('profileTenant');

    // Loading State
    fullNameEl.innerText = "Cargando...";
    usernameEl.innerText = "...";
    roleEl.innerText = "...";
    tenantEl.innerText = "...";
    
    modal.classList.remove('hidden');

    try {
        const token = localStorage.getItem('access_token');
        const res = await fetch(`${FULL_API_URL}/users/mi-usuario`, {
             headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
            const user = await res.json();
            fullNameEl.innerText = user.full_name || '-';
            usernameEl.innerText = user.username;
            roleEl.innerText = translateRole(user.role);

            // Handle Tenant Display
            if (user.role === 'ADMIN') {
                tenantRow.classList.add('hidden');
            } else {
                tenantRow.classList.remove('hidden');
                // Backend now returns 'tenant_name' in /mi-usuario
                tenantEl.innerText = user.tenant_name || user.tenant_id || "-";
            }

        } else {
             fullNameEl.innerText = "Error cargando datos";
        }
    } catch (e) {
        console.error(e);
        fullNameEl.innerText = "Error";
    }
}

function closeUserProfileModal() {
    document.getElementById('modalUserProfile').classList.add('hidden');
    document.getElementById('formChangePassword').reset();
}

function togglePasswordForm(show) {
    const btnContainer = document.getElementById('btnChangePasswordContainer');
    const formContainer = document.getElementById('passwordFormContainer');
    const form = document.getElementById('formChangePassword');

    if (show) {
        btnContainer.classList.add('hidden');
        formContainer.classList.remove('hidden');
    } else {
        btnContainer.classList.remove('hidden');
        formContainer.classList.add('hidden');
        form.reset();
    }
    
    // window export for HTML onclick
    window.togglePasswordForm = togglePasswordForm; 
}

async function handleChangePassword(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "Actualizando...";

    const currentPass = document.getElementById('currentPassword').value;
    const newPass = document.getElementById('newPassword').value;
    const confirmPass = document.getElementById('confirmNewPassword').value;

    try {
        if (newPass !== confirmPass) {
            throw new Error("Las nuevas contraseñas no coinciden");
        }
        if (newPass.length < 6) {
             throw new Error("La nueva contraseña debe tener al menos 6 caracteres");
        }

        const token = localStorage.getItem('access_token');
        const res = await fetch(`${FULL_API_URL}/auth/change-password`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                current_password: currentPass,
                new_password: newPass
            })
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || 'Error al cambiar la contraseña');
        }

        showToast('Contraseña actualizada exitosamente');
        closeUserProfileModal();

    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}



window.checkPendingPaymentsBadge = checkPendingPaymentsBadge;

/* --- Global Badge Checker --- */
async function checkPendingPaymentsBadge() {
    // Only for ADMIN
    if (!window.currentUser || window.currentUser.role !== 'ADMIN') return;

    try {
        const token = localStorage.getItem('access_token');
        const res = await fetch(`${FULL_API_URL}/payments/pagos`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
            const payments = await res.json();
            const pendingCount = payments.filter(p => p.status === 'PENDING').length;
            
            const badgeElement = document.getElementById('sidebarPaymentsBadge');
            if (badgeElement) {
                if (pendingCount > 0) {
                    badgeElement.classList.remove('hidden');
                } else {
                    badgeElement.classList.add('hidden');
                }
            }
        }
    } catch (e) {
        console.error("Error checking pending payments:", e);
    }
}

async function checkNotificationsBadge() {
    // For ADMIN or COMPANY
    if (!window.currentUser) return;
    if (window.currentUser.role !== 'ADMIN' && window.currentUser.role !== 'COMPANY') return;

    try {
        const token = localStorage.getItem('access_token');
        // Fetch only PENDING notifications to see if we need a badge
        const res = await fetch(`${FULL_API_URL}/notifications/?status=PENDING`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
            const notifications = await res.json();
            const pendingCount = notifications.length;
            
            // Determine badge ID based on role
            let badgeId = null;
            if (window.currentUser.role === 'ADMIN') {
                badgeId = 'sidebarNotificationsBadgeAdmin';
            } else if (window.currentUser.role === 'COMPANY') {
                badgeId = 'sidebarNotificationsBadgeCompany';
            }

            const badgeElement = document.getElementById(badgeId);
            if (badgeElement) {
                if (pendingCount > 0) {
                    badgeElement.classList.remove('hidden');
                } else {
                    badgeElement.classList.add('hidden');
                }
            }
        }
    } catch (e) {
        console.error("Error checking notifications:", e);
    }
}

window.checkNotificationsBadge = checkNotificationsBadge;

/* --- Resolve Password Modal Logic --- */

async function openResolvePasswordModal(notificationId, userId) {
    const modal = document.getElementById('modalResolveResetPassword');
    const form = document.getElementById('formResolvePassword');
    
    // Reset
    form.reset();
    document.getElementById('resolveNotificationId').value = notificationId;
    document.getElementById('resolveUserId').value = userId;
    
    // UI Elements
    const userEl = document.getElementById('resolveUser');
    const roleEl = document.getElementById('resolveRole');
    const tenantEl = document.getElementById('resolveTenant');
    
    userEl.innerText = "Cargando...";
    roleEl.innerText = "...";
    tenantEl.innerText = "...";
    
    modal.classList.remove('hidden');
    
    try {
        const token = localStorage.getItem('access_token');
        // Fetch Target User Info
        const res = await fetch(`${FULL_API_URL}/users/${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (res.ok) {
            const user = await res.json();
            userEl.innerText = user.username + (user.full_name ? ` (${user.full_name})` : '');
            roleEl.innerText = translateRole(user.role);
            tenantEl.innerText = user.tenant_name || user.tenant_id || "Plataforma";
        } else {
            userEl.innerText = "Error al cargar info";
        }
    } catch (e) {
        console.error(e);
        userEl.innerText = "Error de conexión";
    }
}


function closeResolvePasswordModal() {
    document.getElementById('modalResolveResetPassword').classList.add('hidden');
    document.getElementById('formResolvePassword').reset();
}

async function handleResolvePassword(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerText;
    btn.disabled = true;
    btn.innerText = "Procesando...";
    
    const notifId = document.getElementById('resolveNotificationId').value;
    const userId = document.getElementById('resolveUserId').value;
    const newPass = document.getElementById('resolveNewPassword').value;
    const confirmPass = document.getElementById('resolveConfirmPassword').value;
    
    try {
        if (newPass !== confirmPass) throw new Error("Las contraseñas no coinciden");
        if (newPass.length < 6) throw new Error("La contraseña es muy corta (min 6)");
        
        const token = localStorage.getItem('access_token');
        
        // 1. Update Password
        const pwRes = await fetch(`${FULL_API_URL}/users/${userId}/password`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ new_password: newPass })
        });
        
        if (!pwRes.ok) {
            const err = await pwRes.json().catch(()=>({}));
            throw new Error(err.detail || "Error al actualizar la contraseña");
        }
        
        // 2. Resolve Notification
        const notifRes = await fetch(`${FULL_API_URL}/notifications/${notifId}?new_Status=RESOLVED`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!notifRes.ok) {
           showToast("Contraseña cambiada, pero error al actualizar notificación", "warning");
        } else {
           showToast("Solicitud resuelta exitosamente");
        }
        
        closeResolvePasswordModal();
        fetchNotifications(document.getElementById('dynamic-content'));
        checkNotificationsBadge();

    } catch (e) {
        showToast(e.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerText = originalText;
    }
}

// Bind New Modal Events
document.addEventListener('DOMContentLoaded', () => {
   const formResolve = document.getElementById('formResolvePassword');
   if (formResolve) {
       formResolve.addEventListener('submit', handleResolvePassword);
   }
});

// Window Exports - Consolidated at the end
window.openResolvePasswordModal = openResolvePasswordModal;
window.closeResolvePasswordModal = closeResolvePasswordModal;
window.createNewUser = createNewUser;
window.resolveNotification = resolveNotification;
window.fetchNotifications = fetchNotifications;

window.openUserProfileModal = openUserProfileModal;
window.closeUserProfileModal = closeUserProfileModal;
window.checkPendingPaymentsBadge = checkPendingPaymentsBadge;
window.checkNotificationsBadge = checkNotificationsBadge;
