const API = ''; 
const qs = (sel, root = document) => root.querySelector(sel);
const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const to = id => qs(`#${id}`);

function toast(msg, time = 2500) {
  const container = to('toasts');
  if (!container) return;
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  container.appendChild(t);

  setTimeout(() => { t.style.opacity = 0; }, time - 300);
  setTimeout(() => { t.remove(); }, time);
}


const searchEl = to('search');
const filterCourse = to('filter-course');
const sortEl = to('sort');
const orderEl = to('order');
const btnAdd = to('btn-add');
const btnExport = to('btn-export');
const importFile = to('import-file');
const tableBody = qs('#students-table tbody');
const pager = to('pager');
const statTotal = to('stat-total');
const statAvg = to('stat-avg');
const statActive = to('stat-active');
let courseChart = null;


const modal = to('modal');
const modalForm = to('modal-form');
const modalTitle = to('modal-title');
const modalMessage = to('modal-message');
const btnCancel = to('btn-cancel');


let page = 1;
let limit = 8;
let totalPages = 1;


function buildStudentsUrl(params = {}) {
  const q = encodeURIComponent(searchEl.value.trim());
  const course = encodeURIComponent(filterCourse.value || '');
  const sort = encodeURIComponent(sortEl.value || '');
  const order = encodeURIComponent(orderEl.value || '');
  const p = params.page || page;
  const l = params.limit || limit;
  return `${API}/students?q=${q}&course=${course}&sort=${sort}&order=${order}&page=${p}&limit=${l}`;
}

async function fetchStudents() {
  try {
    const url = buildStudentsUrl();
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch');
    return await res.json();
  } catch (e) {
    toast('Failed to load students');
    return { data: [], total: 0, page: 1, totalPages: 1 };
  }
}


async function render() {
  const { data, total, page: curPage = 1, totalPages: tp = 1 } = await fetchStudents();
  totalPages = tp;
  page = curPage;

  tableBody.innerHTML = '';
  if (!data || data.length === 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="7" class="no-data">No students found</td>`;
    tableBody.appendChild(tr);
  } else {
    data.forEach(s => {
      const tr = document.createElement('tr');
      const admission = s.admissionDate ? new Date(s.admissionDate).toLocaleDateString() : '-';
      tr.innerHTML = `
        <td>${escapeHtml(s.rollNumber || '')}</td>
        <td>
          <div class="cell-with-avatar">
            ${s.avatarUrl ? `<img src="${escapeHtml(s.avatarUrl)}" alt="" class="avatar" />`
                       : `<div class="avatar-placeholder">${escapeHtml((s.name || ' ')[0] || '?').toUpperCase()}</div>`}
            <div class="cell-text">
              <div class="name">${escapeHtml(s.name || '-')}</div>
              <div class="email">${escapeHtml(s.email || '-')}</div>
            </div>
          </div>
        </td>
        <td>${escapeHtml(String(s.age || '-'))}</td>
        <td>${escapeHtml(s.course || '-')}</td>
        <td>${escapeHtml(admission)}</td>
        <td>${escapeHtml(s.status || '-')}</td>
        <td class="actions">
          <button class="btn action-edit" onclick="openEdit('${s.id}')">✏️ Edit</button>
          <button class="btn action-delete" onclick="removeStudent('${s.id}')">🗑 Delete</button>
        </td>
      `;
      tableBody.appendChild(tr);
    });
  }

  renderPager();
  updateStatsAndChart();
}

function renderPager() {
  pager.innerHTML = '';
  const createBtn = (text, p, disabled = false) => {
    const b = document.createElement('button');
    b.textContent = text;
    b.disabled = !!disabled;
    b.addEventListener('click', () => { page = p; render(); });
    pager.appendChild(b);
  };

  createBtn('Prev', Math.max(1, page - 1), page === 1);

  
  const maxButtons = 7;
  if (totalPages <= maxButtons) {
    for (let i = 1; i <= totalPages; i++) {
      createBtn(String(i), i, i === page);
    }
  } else {
  
    createBtn('1', 1, page === 1);
    let start = Math.max(2, page - 2);
    let end = Math.min(totalPages - 1, page + 2);
    if (start > 2) {
      const dots = document.createElement('span'); dots.textContent = '...'; pager.appendChild(dots);
    }
    for (let i = start; i <= end; i++) createBtn(String(i), i, i === page);
    if (end < totalPages - 1) {
      const dots = document.createElement('span'); dots.textContent = '...'; pager.appendChild(dots);
    }
    createBtn(String(totalPages), totalPages, page === totalPages);
  }

  createBtn('Next', Math.min(totalPages, page + 1), page === totalPages);
}


async function updateStatsAndChart() {
  try {
    const url = `${API}/students?limit=10000`;
    const res = await fetch(url);
    if (!res.ok) return;
    const payload = await res.json();
    const arr = payload.data || [];


    statTotal.textContent = arr.length;
    const ages = arr.map(s => Number(s.age)).filter(n => !Number.isNaN(n) && n > 0);
    const avg = ages.length ? Math.round((ages.reduce((a, b) => a + b, 0) / ages.length)) : '-';
    statAvg.textContent = avg;
    statActive.textContent = arr.filter(s => s.status === 'Active').length;

    const byCourse = arr.reduce((acc, s) => {
      const c = s.course || 'Other';
      acc[c] = (acc[c] || 0) + 1;
      return acc;
    }, {});

    filterCourse.innerHTML = '<option value="">All courses</option>';
    Object.keys(byCourse).sort().forEach(c => {
      const o = document.createElement('option');
      o.value = c;
      o.textContent = `${c} (${byCourse[c]})`;
      filterCourse.appendChild(o);
    });

    
    const labels = Object.keys(byCourse);
    const data = labels.map(l => byCourse[l]);
    const colors = generateColors(labels.length);

    if (!courseChart) {
      const ctx = document.getElementById('courseChart').getContext('2d');
      courseChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{ data, backgroundColor: colors }]
        },
        options: {
          plugins: { legend: { position: 'bottom' } },
          maintainAspectRatio: false
        }
      });
    } else {
      courseChart.data.labels = labels;
      courseChart.data.datasets[0].data = data;
      courseChart.data.datasets[0].backgroundColor = colors;
      courseChart.update();
    }
  } catch (e) {
   
  }
}

function generateColors(n) {
 
  const base = ['#0077ff','#ff6384','#36a2eb','#ffce56','#2ecc71','#9b59b6','#e67e22','#1abc9c'];
  const out = [];
  for (let i = 0; i < n; i++) out.push(base[i % base.length]);
  return out;
}


btnAdd.addEventListener('click', () => openAdd());

function openAdd() {
  modalTitle.textContent = 'Add Student';
  modalForm.reset();
  modalForm.id.value = '';
  modalMessage.textContent = '';
  showModal();
}

window.openEdit = async function (id) {
  modalTitle.textContent = 'Edit Student';
  modalForm.id.value = id;
  modalMessage.textContent = 'Loading...';
  showModal();
  try {
    const res = await fetch(`${API}/students/${id}`);
    if (!res.ok) { modalMessage.textContent = 'Failed to load'; return; }
    const s = await res.json();
   
    modalForm.rollNumber.value = s.rollNumber || '';
    modalForm.name.value = s.name || '';
    modalForm.email.value = s.email || '';
    modalForm.phone.value = s.phone || '';
    modalForm.age.value = s.age || '';
    modalForm.course.value = s.course || '';
    modalForm.admissionDate.value = s.admissionDate ? new Date(s.admissionDate).toISOString().slice(0,10) : '';
    modalForm.gender.value = s.gender || 'Other';
    modalForm.status.value = s.status || 'Active';
    modalForm.address.value = s.address || '';
    modalForm.avatarUrl.value = s.avatarUrl || '';
    modalMessage.textContent = '';
  } catch (err) {
    modalMessage.textContent = 'Error';
  }
};

function showModal() { modal.classList.remove('hidden'); }
function hideModal() { modal.classList.add('hidden'); }

btnCancel.addEventListener('click', () => hideModal());


modalForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  modalMessage.textContent = 'Saving...';
  const data = Object.fromEntries(new FormData(modalForm).entries());

  if (data.age === '') delete data.age;
  if (data.phone === '') delete data.phone;

  try {
    let res;
    if (data.id) {
      res = await fetch(`${API}/students/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } else {
      res = await fetch(`${API}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    }

    const body = await res.json().catch(() => null);
    if (!res.ok) {
      modalMessage.textContent = body && body.error ? body.error : 'Failed';
      return;
    }

    hideModal();
    toast(data.id ? 'Student updated' : 'Student created');
    render();
  } catch (err) {
    modalMessage.textContent = 'Error saving';
  }
});

window.removeStudent = async function (id) {
  if (!confirm('Delete this student?')) return;
  try {
    const res = await fetch(`${API}/students/${id}`, { method: 'DELETE' });
    if (res.status === 204) {
      toast('Deleted');
    
      render();
    } else {
      toast('Delete failed');
    }
  } catch (e) {
    toast('Delete failed');
  }
};


btnExport.addEventListener('click', () => {
  const url = `${API}/students/export`;
  window.open(url, '_blank');
});


importFile.addEventListener('change', async (ev) => {
  const f = ev.target.files[0];
  if (!f) return;
  try {
    const text = await f.text();
    const rows = text.split(/\r?\n/).filter(Boolean);
    if (rows.length < 1) {
      toast('CSV empty');
      return;
    }

    const header = parseCsvRow(rows.shift());
    const arr = rows.map(r => {
      const cols = parseCsvRow(r);
      const obj = {};
      for (let i = 0; i < header.length; i++) {
        obj[header[i]] = cols[i] || '';
      }
      return obj;
    });

    const studentsToImport = arr.map(a => ({
      rollNumber: a.rollNumber || a.RollNumber || a.roll || '',
      name: a.name || a.Name || '',
      email: a.email || a.Email || '',
      phone: a.phone || '',
      age: a.age || '',
      course: a.course || '',
      address: a.address || '',
      admissionDate: a.admissionDate || '',
      gender: a.gender || '',
      status: a.status || '',
      avatarUrl: a.avatarUrl || ''
    }));

    const res = await fetch(`${API}/students/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ students: studentsToImport })
    });
    const body = await res.json();
    toast(`Imported: added ${body.added}, skipped ${body.skipped}`);
    importFile.value = '';
    render();
  } catch (err) {
    toast('Import failed');
    importFile.value = '';
  }
});


function parseCsvRow(row) {
  const re = /("([^"]*(?:""[^"]*)*)"|[^,]+|)(,|$)/g;
  const out = [];
  let m;
  while ((m = re.exec(row)) !== null) {
    let val = m[2] !== undefined ? m[2].replace(/""/g, '"') : (m[1] || '');
    out.push(val);
    if (m[3] === '') break;
  }
  return out.map(x => x.trim());
}

[searchEl, sortEl, orderEl, filterCourse].forEach(el => {
  el.addEventListener('change', () => { page = 1; render(); });
});
searchEl.addEventListener('input', () => { page = 1; debounceRender(); });

let debounceTimer = null;
function debounceRender() { clearTimeout(debounceTimer); debounceTimer = setTimeout(() => render(), 350); }


function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

(async function init() {
 
  if (filterCourse && filterCourse.children.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = 'All courses';
    filterCourse.appendChild(opt);
  }
  await render();
})();
