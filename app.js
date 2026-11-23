/**
 * Enterprise XML Employee Directory Engine
 * Architecture:
 * - Decoupled XML Ingestion (Fetch API & FileReader API for direct local inspection)
 * - Safe XML Parsing via standard DOMParser with syntax error boundary
 * - Normalized In-Memory Store & Dynamic Multi-column Filtering
 * - Bi-directional Sorting & Paginated Rendering
 * - CSV Export Utility
 * - Accessible DOM Rendering with responsive KPI metrics
 */

(function () {
  'use strict';

  // State Management
  const state = {
    employees: [],
    filteredEmployees: [],
    currentSource: null,
    searchQuery: '',
    selectedDepartment: 'ALL',
    selectedStatus: 'ALL',
    sortColumn: 'id',
    sortDirection: 'asc', // 'asc' | 'desc'
    currentPage: 1,
    pageSize: 5
  };

  // DOM Elements Cache
  const DOM = {
    loadSampleBtn: document.getElementById('loadSampleBtn'),
    fileInput: document.getElementById('fileInput'),
    exportCsvBtn: document.getElementById('exportCsvBtn'),
    tableBody: document.getElementById('tableBody'),
    tableHeaders: document.querySelectorAll('#employeeTable thead th.sortable'),
    searchInput: document.getElementById('searchInput'),
    departmentFilter: document.getElementById('departmentFilter'),
    statusFilter: document.getElementById('statusFilter'),
    statusBanner: document.getElementById('statusBanner'),
    statusMessage: document.getElementById('statusMessage'),
    resultsCount: document.getElementById('resultsCount'),
    loadedFileSource: document.getElementById('loadedFileSource'),
    statTotalEmployees: document.getElementById('statTotalEmployees'),
    statActiveEmployees: document.getElementById('statActiveEmployees'),
    statDepartments: document.getElementById('statDepartments'),
    statAvgSalary: document.getElementById('statAvgSalary'),
    prevPageBtn: document.getElementById('prevPageBtn'),
    nextPageBtn: document.getElementById('nextPageBtn'),
    pageIndicator: document.getElementById('pageIndicator')
  };

  /**
   * Helper: Parse XML text using DOMParser with error detection
   * @param {string} xmlString 
   * @returns {Document}
   */
  function parseXMLString(xmlString) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, 'application/xml');
    const parserError = xmlDoc.querySelector('parsererror');

    if (parserError) {
      throw new Error(`XML Parsing Failed: ${parserError.textContent}`);
    }

    return xmlDoc;
  }

  /**
   * Extract and normalize employee data from an XML Document
   * @param {Document} xmlDoc 
   * @returns {Array<Object>}
   */
  function extractEmployeesFromXML(xmlDoc) {
    const employeeNodes = xmlDoc.querySelectorAll('employee');
    const extracted = [];

    employeeNodes.forEach((node) => {
      const getVal = (selector, fallback = '—') => {
        const el = node.querySelector(selector);
        return el ? el.textContent.trim() : fallback;
      };

      const id = node.getAttribute('id') || getVal('id', 'N/A');
      const name = getVal('name');
      const department = getVal('department');
      const role = getVal('role', getVal('designation', '—'));
      const email = getVal('email');
      
      const salaryEl = node.querySelector('salary');
      const rawSalary = salaryEl ? parseFloat(salaryEl.textContent.replace(/[^0-9.-]+/g, '')) : 0;
      const currency = salaryEl && salaryEl.getAttribute('currency') ? salaryEl.getAttribute('currency') : 'USD';

      const joiningDate = getVal('joiningDate', getVal('joinDate', '—'));
      const status = getVal('status', 'Active');

      extracted.push({
        id,
        name,
        department,
        role,
        email,
        salary: isNaN(rawSalary) ? 0 : rawSalary,
        currency,
        joiningDate,
        status
      });
    });

    return extracted;
  }

  /**
   * Update Notification / Status Banner
   */
  function setStatusBanner(message, type = 'info') {
    DOM.statusBanner.className = `status-banner ${type}`;
    DOM.statusMessage.textContent = message;
  }

  /**
   * Format currency representation
   */
  function formatCurrency(amount, currency = 'USD') {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        maximumFractionDigits: 0
      }).format(amount);
    } catch {
      return `$${amount.toLocaleString()}`;
    }
  }

  /**
   * Status badge markup generator
   */
  function renderStatusBadge(status) {
    const cleanStatus = (status || '').toLowerCase();
    let badgeClass = 'badge-default';

    if (cleanStatus.includes('active')) {
      badgeClass = 'badge-active';
    } else if (cleanStatus.includes('leave')) {
      badgeClass = 'badge-leave';
    } else if (cleanStatus.includes('probation')) {
      badgeClass = 'badge-probation';
    }

    return `<span class="badge ${badgeClass}">${escapeHtml(status)}</span>`;
  }

  /**
   * Recompute KPI summary metrics
   */
  function updateKPIs(employees) {
    const total = employees.length;
    DOM.statTotalEmployees.textContent = total;

    const activeCount = employees.filter((e) => e.status.toLowerCase() === 'active').length;
    DOM.statActiveEmployees.textContent = activeCount;

    const uniqueDepts = new Set(employees.map((e) => e.department).filter((d) => d && d !== '—'));
    DOM.statDepartments.textContent = uniqueDepts.size;

    const totalSalary = employees.reduce((sum, e) => sum + e.salary, 0);
    const avgSalary = total > 0 ? totalSalary / total : 0;
    DOM.statAvgSalary.textContent = formatCurrency(avgSalary);
  }

  /**
   * Populate Department Filter Dropdown dynamically based on dataset
   */
  function populateDepartmentFilter(employees) {
    const current = DOM.departmentFilter.value;
    const departments = Array.from(
      new Set(employees.map((e) => e.department).filter((d) => d && d !== '—'))
    ).sort();

    DOM.departmentFilter.innerHTML = '<option value="ALL">All Departments</option>';
    departments.forEach((dept) => {
      const opt = document.createElement('option');
      opt.value = dept;
      opt.textContent = dept;
      DOM.departmentFilter.appendChild(opt);
    });

    if (departments.includes(current)) {
      DOM.departmentFilter.value = current;
    } else {
      DOM.departmentFilter.value = 'ALL';
    }
  }

  /**
   * Escape HTML to prevent XSS injection from untrusted XML fields
   */
  function escapeHtml(str) {
    if (typeof str !== 'string') return String(str ?? '');
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  /**
   * Sort array of employees
   */
  function sortData(list) {
    const col = state.sortColumn;
    const dir = state.sortDirection === 'asc' ? 1 : -1;

    return [...list].sort((a, b) => {
      let valA = a[col];
      let valB = b[col];

      if (col === 'salary') {
        return (valA - valB) * dir;
      }

      valA = String(valA || '').toLowerCase();
      valB = String(valB || '').toLowerCase();

      return valA.localeCompare(valB) * dir;
    });
  }

  /**
   * Apply Search and Filter rules and update View
   */
  function applyFilters() {
    const q = state.searchQuery.toLowerCase().trim();
    const dept = state.selectedDepartment;
    const status = state.selectedStatus;

    let filtered = state.employees.filter((emp) => {
      const matchesSearch =
        !q ||
        emp.id.toLowerCase().includes(q) ||
        emp.name.toLowerCase().includes(q) ||
        emp.department.toLowerCase().includes(q) ||
        emp.role.toLowerCase().includes(q) ||
        emp.email.toLowerCase().includes(q);

      const matchesDept = dept === 'ALL' || emp.department === dept;
      const matchesStatus = status === 'ALL' || emp.status.toLowerCase() === status.toLowerCase();

      return matchesSearch && matchesDept && matchesStatus;
    });

    state.filteredEmployees = sortData(filtered);
    state.currentPage = 1; // Reset to first page whenever filter changes
    renderTable();
  }

  /**
   * Update Sort Header UI Indicators
   */
  function updateHeaderIndicators() {
    DOM.tableHeaders.forEach((th) => {
      th.classList.remove('sort-asc', 'sort-desc');
      if (th.dataset.sort === state.sortColumn) {
        th.classList.add(state.sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
      }
    });
  }

  /**
   * Render Table Body rows with Pagination
   */
  function renderTable() {
    const totalItems = state.filteredEmployees.length;
    const totalPages = Math.ceil(totalItems / state.pageSize) || 1;

    if (state.currentPage > totalPages) {
      state.currentPage = totalPages;
    }

    const startIndex = (state.currentPage - 1) * state.pageSize;
    const paginatedItems = state.filteredEmployees.slice(startIndex, startIndex + state.pageSize);

    if (totalItems === 0) {
      DOM.tableBody.innerHTML = `
        <tr class="empty-placeholder">
          <td colspan="8">
            <div class="empty-state">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <p>No employee records matched your criteria.</p>
            </div>
          </td>
        </tr>
      `;
      DOM.resultsCount.textContent = 'Displaying 0 records';
      DOM.prevPageBtn.disabled = true;
      DOM.nextPageBtn.disabled = true;
      DOM.pageIndicator.textContent = 'Page 1 of 1';
      return;
    }

    const rowsHtml = paginatedItems.map((emp) => `
      <tr>
        <td><span class="emp-id">${escapeHtml(emp.id)}</span></td>
        <td class="emp-name">${escapeHtml(emp.name)}</td>
        <td>${escapeHtml(emp.department)}</td>
        <td>${escapeHtml(emp.role)}</td>
        <td><a class="emp-email" href="mailto:${encodeURIComponent(emp.email)}">${escapeHtml(emp.email)}</a></td>
        <td class="text-right salary-val">${formatCurrency(emp.salary, emp.currency)}</td>
        <td>${escapeHtml(emp.joiningDate)}</td>
        <td>${renderStatusBadge(emp.status)}</td>
      </tr>
    `).join('');

    DOM.tableBody.innerHTML = rowsHtml;
    DOM.resultsCount.textContent = `Showing ${startIndex + 1}–${Math.min(startIndex + state.pageSize, totalItems)} of ${totalItems} record(s)`;

    // Pagination controls
    DOM.pageIndicator.textContent = `Page ${state.currentPage} of ${totalPages}`;
    DOM.prevPageBtn.disabled = state.currentPage <= 1;
    DOM.nextPageBtn.disabled = state.currentPage >= totalPages;
  }

  /**
   * Export currently filtered data as a CSV file
   */
  function exportToCsv() {
    if (!state.filteredEmployees.length) {
      alert('No records available to export.');
      return;
    }

    const headers = ['Employee ID', 'Full Name', 'Department', 'Role', 'Email', 'Salary', 'Currency', 'Join Date', 'Status'];
    const csvRows = [headers.join(',')];

    state.filteredEmployees.forEach((emp) => {
      const row = [
        `"${emp.id}"`,
        `"${emp.name.replace(/"/g, '""')}"`,
        `"${emp.department.replace(/"/g, '""')}"`,
        `"${emp.role.replace(/"/g, '""')}"`,
        `"${emp.email.replace(/"/g, '""')}"`,
        emp.salary,
        `"${emp.currency}"`,
        `"${emp.joiningDate}"`,
        `"${emp.status}"`
      ];
      csvRows.push(row.join(','));
    });

    const csvBlob = new Blob([csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(csvBlob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `employees_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Commit parsed data into state and activate UI controls
   */
  function ingestData(employees, sourceLabel) {
    if (!employees || employees.length === 0) {
      throw new Error('The XML document does not contain any <employee> records.');
    }

    state.employees = employees;
    state.currentSource = sourceLabel;

    // Enable interactive controls
    DOM.searchInput.disabled = false;
    DOM.departmentFilter.disabled = false;
    DOM.statusFilter.disabled = false;
    DOM.exportCsvBtn.disabled = false;

    // Synchronize UI
    DOM.loadedFileSource.textContent = `Source: ${sourceLabel}`;
    populateDepartmentFilter(employees);
    updateKPIs(employees);
    updateHeaderIndicators();
    applyFilters();

    setStatusBanner(`Successfully parsed and loaded ${employees.length} employee record(s) from "${sourceLabel}".`, 'success');
  }

  /**
   * Load bundled default XML file via Fetch API
   */
  async function loadDefaultXml() {
    const targetUrl = 'employees.xml';
    setStatusBanner(`Fetching ${targetUrl}...`, 'info');

    try {
      const response = await fetch(targetUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch ${targetUrl}`);
      }

      const xmlText = await response.text();
      const xmlDoc = parseXMLString(xmlText);
      const employees = extractEmployeesFromXML(xmlDoc);

      ingestData(employees, targetUrl);
    } catch (err) {
      console.warn('Fetch failed, providing diagnostic guide:', err);
      setStatusBanner(
        `Direct fetch restricted (${err.message}). Use the "Upload XML File" button to inspect any XML file directly.`,
        'error'
      );
    }
  }

  /**
   * Handle user-uploaded XML file via FileReader
   */
  function handleFileUpload(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    setStatusBanner(`Reading file "${file.name}"...`, 'info');

    const reader = new FileReader();

    reader.onload = function (e) {
      try {
        const xmlText = e.target.result;
        const xmlDoc = parseXMLString(xmlText);
        const employees = extractEmployeesFromXML(xmlDoc);
        ingestData(employees, file.name);
      } catch (err) {
        console.error('File parsing error:', err);
        setStatusBanner(`Failed to parse XML: ${err.message}`, 'error');
      }
    };

    reader.onerror = function () {
      setStatusBanner(`Error reading file "${file.name}".`, 'error');
    };

    reader.readAsText(file);
    event.target.value = '';
  }

  /**
   * Attach Event Listeners
   */
  function initEvents() {
    DOM.loadSampleBtn.addEventListener('click', loadDefaultXml);
    DOM.fileInput.addEventListener('change', handleFileUpload);
    DOM.exportCsvBtn.addEventListener('click', exportToCsv);

    DOM.searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      applyFilters();
    });

    DOM.departmentFilter.addEventListener('change', (e) => {
      state.selectedDepartment = e.target.value;
      applyFilters();
    });

    DOM.statusFilter.addEventListener('change', (e) => {
      state.selectedStatus = e.target.value;
      applyFilters();
    });

    // Column Sorting
    DOM.tableHeaders.forEach((th) => {
      th.addEventListener('click', () => {
        const col = th.dataset.sort;
        if (state.sortColumn === col) {
          state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          state.sortColumn = col;
          state.sortDirection = 'asc';
        }
        updateHeaderIndicators();
        state.filteredEmployees = sortData(state.filteredEmployees);
        renderTable();
      });
    });

    // Pagination
    DOM.prevPageBtn.addEventListener('click', () => {
      if (state.currentPage > 1) {
        state.currentPage--;
        renderTable();
      }
    });

    DOM.nextPageBtn.addEventListener('click', () => {
      const totalPages = Math.ceil(state.filteredEmployees.length / state.pageSize);
      if (state.currentPage < totalPages) {
        state.currentPage++;
        renderTable();
      }
    });
  }

  // Initialization
  document.addEventListener('DOMContentLoaded', () => {
    initEvents();

    if (window.location.protocol.startsWith('http')) {
      loadDefaultXml();
    }
  });
})();
