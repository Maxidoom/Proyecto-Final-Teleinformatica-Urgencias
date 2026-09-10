'use strict';

// ── Data ──────────────────────────────────────────────────────────────────────

const TRIAGE = {
  1: { label: 'Resucitación', cls: 't1' },
  2: { label: 'Emergencia',   cls: 't2' },
  3: { label: 'Urgencia',     cls: 't3' },
  4: { label: 'Menos urgente',cls: 't4' },
  5: { label: 'No urgente',   cls: 't5' },
};

const STATUS = {
  en_espera:      { label: 'En espera' },
  en_atencion:    { label: 'En atención' },
  en_observacion: { label: 'En observación' },
  alta:           { label: 'Alta médica' },
  transferido:    { label: 'Transferido' },
};

const DOCTORES_SEED = ['Dr. Ramírez','Dra. Chen','Dr. Morales','Dra. Ibarra','Dr. Vega'];

let folioCounter = 2461;

function mkPatient(id, folio, nombre, edad, sexo, triage, motivo, offsetMins, doctor, status, ta, fc, temp, spo2, notas) {
  return { id, folio, nombre, edad, sexo, triage, motivoConsulta: motivo,
    llegada: new Date(Date.now() - offsetMins * 60000),
    doctor, status, presionArterial: ta, frecuenciaCardiaca: fc,
    temperatura: temp, saturacion: spo2, notas };
}

const SEED_PATIENTS = [
];

// ── State ─────────────────────────────────────────────────────────────────────

let state = {
  doctor: null,
  patients: SEED_PATIENTS.map(p => ({ ...p })),
  filterTriage: 0,
  filterStatus: 'todos',
  search: '',
  editingDetail: false,
  openPatientId: null,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtWait(date) {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins/60)}h ${mins%60}m`;
}

function fmtTime(date) {
  return date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(date) {
  return date.toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long', year:'numeric' });
}

function initials(name) {
  return name.split(' ').filter(w => /^[A-ZÁÉÍÓÚÑ]/i.test(w)).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

function triage_badge(level) {
  return `<span class="triage-badge ${TRIAGE[level].cls}"><span class="dot"></span>T${level}</span>`;
}

function status_badge(status) {
  return `<span class="status-badge s-${status}">${STATUS[status].label}</span>`;
}

function vital_chip(label, value, unit, warn) {
  return `<div class="vital-chip${warn?' warn':''}">
    <span class="vl">${label}</span>
    <span class="vv">${value}<span class="vu">${unit}</span></span>
  </div>`;
}

function filtered_patients() {
  return state.patients
    .filter(p => {
      if (state.filterTriage !== 0 && p.triage !== state.filterTriage) return false;
      if (state.filterStatus !== 'todos' && p.status !== state.filterStatus) return false;
      const q = state.search.toLowerCase();
      if (q && !p.nombre.toLowerCase().includes(q) && !p.folio.toLowerCase().includes(q)) return false;
      return true;
    })
    .sort((a, b) => a.triage - b.triage || a.llegada - b.llegada);
}

// ── Clock ─────────────────────────────────────────────────────────────────────

function tick() {
  const el = document.getElementById('clock');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toLocaleTimeString('es-MX', { hour:'2-digit', minute:'2-digit' })
    + ' — ' + now.toLocaleDateString('es-MX', { weekday:'short', day:'numeric', month:'short' });
}
setInterval(tick, 30000);

// ── Render ────────────────────────────────────────────────────────────────────

function renderStats() {
  const p = state.patients;
  document.getElementById('stat-total').textContent    = p.filter(x => x.status !== 'alta' && x.status !== 'transferido').length;
  document.getElementById('stat-espera').textContent   = p.filter(x => x.status === 'en_espera').length;
  document.getElementById('stat-atencion').textContent = p.filter(x => x.status === 'en_atencion').length;
  document.getElementById('stat-criticos').textContent = p.filter(x => x.triage <= 2 && x.status !== 'alta' && x.status !== 'transferido').length;
}

function renderTable() {
  const rows = filtered_patients();
  const tbody = document.getElementById('patients-tbody');
  const empty = document.getElementById('empty-state');
  document.getElementById('results-count').textContent = `${rows.length} resultado${rows.length !== 1 ? 's' : ''}`;

  if (rows.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  tbody.innerHTML = rows.map((p, i) => {
    const active = p.status === 'en_atencion' || p.status === 'en_observacion';
    const waitWarn = p.triage <= 2 && parseInt(fmtWait(p.llegada)) > 15;
    return `<tr data-id="${p.id}" style="${i%2===1?'background:rgba(15,23,42,.2)':''}">
      <td><span class="mono" style="font-size:.72rem;color:var(--text3)">${p.folio}</span></td>
      <td><div class="patient-cell">${active ? '<span class="pulse-dot"></span>' : ''}<span style="font-size:.85rem;font-weight:500">${p.nombre}</span></div></td>
      <td><span class="mono" style="color:var(--text3)">${p.edad}</span> <span style="font-size:.72rem;color:var(--text3)">${p.sexo}</span></td>
      <td>${triage_badge(p.triage)}</td>
      <td style="max-width:220px"><p class="truncate" style="font-size:.85rem;color:#cbd5e1">${p.motivoConsulta}</p></td>
      <td><span class="mono" style="font-size:.72rem;color:var(--text3)">${fmtTime(p.llegada)}</span></td>
      <td><span class="mono" style="font-size:.72rem;color:${waitWarn?'var(--red)':'var(--text3)'}">${fmtWait(p.llegada)}</span></td>
      <td><span style="font-size:.72rem;color:var(--text3)">${p.doctor || '<em style="color:var(--text3)">—</em>'}</span></td>
      <td>${status_badge(p.status)}</td>
      <td><span class="row-arrow"><svg fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg></span></td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('tr').forEach(tr => {
    tr.addEventListener('click', () => openDetail(tr.dataset.id));
  });
}

function render() {
  renderStats();
  renderTable();
}

// ── Detail modal ──────────────────────────────────────────────────────────────

function openDetail(id) {
  const p = state.patients.find(x => x.id === id);
  if (!p) return;
  state.openPatientId = id;
  state.editingDetail = false;
  populateDetail(p);
  setDetailEditMode(false);
  document.getElementById('detail-modal').classList.remove('hidden');
}

function populateDetail(p) {
  const hdr = document.getElementById('detail-header');
  hdr.style.borderColor = '';
  hdr.className = 'modal-header';

  document.getElementById('detail-triage-badge').innerHTML = triage_badge(p.triage);
  document.getElementById('detail-folio').textContent = p.folio;
  document.getElementById('detail-ingreso').textContent = 'Ingreso ' + fmtTime(p.llegada);
  document.getElementById('detail-nombre').textContent = p.nombre;
  document.getElementById('detail-info').textContent = `${p.edad} años · ${p.sexo === 'M' ? 'Masculino' : 'Femenino'}`;
  document.getElementById('detail-motivo').textContent = p.motivoConsulta;

  // Vitals
  const taVal = parseInt(p.presionArterial);
  document.getElementById('detail-vitals').innerHTML =
    vital_chip('TA',   p.presionArterial, 'mmHg', taVal >= 160) +
    vital_chip('FC',   p.frecuenciaCardiaca, 'lpm', p.frecuenciaCardiaca > 100 || p.frecuenciaCardiaca < 50) +
    vital_chip('Temp', p.temperatura.toFixed(1), '°C', p.temperatura >= 38.5) +
    vital_chip('SpO₂', p.saturacion, '%', p.saturacion < 94) +
    vital_chip('Espera', fmtWait(p.llegada), '');

  // Doctor
  document.getElementById('detail-doctor-view').innerHTML = p.doctor || '<em style="color:var(--text3)">Sin asignar</em>';
  const docSel = document.getElementById('detail-doctor-edit');
  const others = DOCTORES_SEED.filter(d => d !== state.doctor);
  docSel.innerHTML = `<option value="">Sin asignar</option>
    <option value="${state.doctor}">${state.doctor} (tú)</option>
    ${others.map(d => `<option value="${d}">${d}</option>`).join('')}`;
  docSel.value = p.doctor || '';

  // Status
  document.getElementById('detail-status-view').innerHTML = status_badge(p.status);
  document.getElementById('detail-status-edit').value = p.status;

  // Notas
  document.getElementById('detail-notas-view').innerHTML = p.notas
    ? p.notas
    : '<em style="color:var(--text3)">Sin notas registradas</em>';
  document.getElementById('detail-notas-edit').value = p.notas;
}

function setDetailEditMode(editing) {
  state.editingDetail = editing;
  const views  = ['detail-doctor-view','detail-status-view','detail-notas-view'];
  const edits  = ['detail-doctor-edit','detail-status-edit','detail-notas-edit'];
  views.forEach(id => document.getElementById(id).classList.toggle('hidden', editing));
  edits.forEach(id => document.getElementById(id).classList.toggle('hidden', !editing));
  document.getElementById('detail-cancel-btn').textContent = editing ? 'Cancelar' : 'Cerrar';
  document.getElementById('detail-edit-btn').classList.toggle('hidden', editing);
  document.getElementById('detail-save-btn').classList.toggle('hidden', !editing);
}

function saveDetail() {
  const p = state.patients.find(x => x.id === state.openPatientId);
  if (!p) return;
  const docVal = document.getElementById('detail-doctor-edit').value;
  p.doctor = docVal || state.doctor;
  p.status = document.getElementById('detail-status-edit').value;
  p.notas  = document.getElementById('detail-notas-edit').value;
  populateDetail(p);
  setDetailEditMode(false);
  render();
}

function closeDetail() {
  document.getElementById('detail-modal').classList.add('hidden');
  state.openPatientId = null;
}

// ── New patient modal ─────────────────────────────────────────────────────────

let npTriage = 3;

function openNewPatient() {
  document.getElementById('np-nombre').value = '';
  document.getElementById('np-edad').value = '';
  document.getElementById('np-sexo').value = 'M';
  document.getElementById('np-motivo').value = '';
  npTriage = 3;
  document.querySelectorAll('#np-triage-btns .triage-btn').forEach(b => {
    b.className = 'triage-btn' + (parseInt(b.dataset.t) === 3 ? ' sel-3' : '');
  });
  document.getElementById('new-modal-submit').disabled = true;
  document.getElementById('new-modal').classList.remove('hidden');
  document.getElementById('np-nombre').focus();
}

function closeNewPatient() {
  document.getElementById('new-modal').classList.add('hidden');
}

function checkNewForm() {
  const ok = document.getElementById('np-nombre').value.trim() &&
             document.getElementById('np-edad').value.trim() &&
             document.getElementById('np-motivo').value.trim();
  document.getElementById('new-modal-submit').disabled = !ok;
}

function submitNewPatient() {
  const nombre = document.getElementById('np-nombre').value.trim();
  const edad   = parseInt(document.getElementById('np-edad').value);
  const sexo   = document.getElementById('np-sexo').value;
  const motivo = document.getElementById('np-motivo').value.trim();
  if (!nombre || !edad || !motivo) return;

  const id    = String(Date.now());
  const folio = 'URG-' + (folioCounter++);
  state.patients.unshift({
    id, folio, nombre, edad, sexo, triage: npTriage,
    motivoConsulta: motivo, llegada: new Date(),
    doctor: state.doctor, status: 'en_espera',
    presionArterial: '—', frecuenciaCardiaca: 0,
    temperatura: 36.5, saturacion: 98, notas: '',
  });
  closeNewPatient();
  render();
}

// ── Login ─────────────────────────────────────────────────────────────────────

function showDashboard(doctorName) {
  state.doctor = doctorName;
  document.getElementById('login-screen').classList.remove('active');
  document.getElementById('dashboard-screen').classList.add('active');
  document.getElementById('doctor-name').textContent = doctorName;
  document.getElementById('doctor-avatar').textContent = initials(doctorName);
  tick();
  render();
}

function logout() {
  state.doctor = null;
  document.getElementById('dashboard-screen').classList.remove('active');
  document.getElementById('login-screen').classList.add('active');
  document.getElementById('login-nombre').value = '';
  document.getElementById('login-btn').disabled = true;
  document.getElementById('login-preview').classList.add('hidden');
}

// ── Boot & events ─────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  // Login date
  document.getElementById('login-date').textContent = fmtDate(new Date());

  // Login form
  const loginNombre = document.getElementById('login-nombre');
  const loginTitulo = document.getElementById('login-titulo');
  const loginBtn    = document.getElementById('login-btn');
  const loginPreview = document.getElementById('login-preview');

  function updateLoginPreview() {
    const name = loginNombre.value.trim();
    loginBtn.disabled = !name;
    if (name) {
      loginPreview.classList.remove('hidden');
      loginPreview.querySelector('span').textContent = `${loginTitulo.value} ${name}`;
    } else {
      loginPreview.classList.add('hidden');
    }
  }

  loginNombre.addEventListener('input', updateLoginPreview);
  loginTitulo.addEventListener('change', updateLoginPreview);

  document.getElementById('login-form').addEventListener('submit', e => {
    e.preventDefault();
    const name = loginNombre.value.trim();
    if (!name) return;
    showDashboard(`${loginTitulo.value} ${name}`);
  });

  // Logout
  document.getElementById('btn-logout').addEventListener('click', logout);

  // Stats new patient button
  document.getElementById('btn-new-patient').addEventListener('click', openNewPatient);

  // Search
  document.getElementById('search-input').addEventListener('input', e => {
    state.search = e.target.value;
    renderTable();
  });

  // Triage filters
  document.querySelectorAll('[data-triage]').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = parseInt(btn.dataset.triage);
      state.filterTriage = t;
      document.querySelectorAll('[data-triage]').forEach(b => {
        const bt = parseInt(b.dataset.triage);
        if (bt === t) {
          b.classList.add('active');
          b.classList.remove('triage-active-1','triage-active-2','triage-active-3','triage-active-4','triage-active-5');
          if (t !== 0) { b.classList.remove('active'); b.classList.add(`triage-active-${t}`); }
        } else {
          b.className = 'filter-btn';
        }
      });
      renderTable();
    });
  });

  // Status filters
  document.querySelectorAll('[data-status]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.filterStatus = btn.dataset.status;
      document.querySelectorAll('[data-status]').forEach(b => {
        b.classList.toggle('active', b.dataset.status === state.filterStatus);
      });
      renderTable();
    });
  });

  // Detail modal
  document.getElementById('detail-close').addEventListener('click', closeDetail);
  document.getElementById('detail-cancel-btn').addEventListener('click', () => {
    if (state.editingDetail) setDetailEditMode(false);
    else closeDetail();
  });
  document.getElementById('detail-edit-btn').addEventListener('click', () => {
    const p = state.patients.find(x => x.id === state.openPatientId);
    if (p && !p.doctor) document.getElementById('detail-doctor-edit').value = state.doctor;
    setDetailEditMode(true);
  });
  document.getElementById('detail-save-btn').addEventListener('click', saveDetail);
  document.getElementById('detail-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('detail-modal')) closeDetail();
  });

  // New patient modal
  document.getElementById('new-modal-close').addEventListener('click', closeNewPatient);
  document.getElementById('new-modal-cancel').addEventListener('click', closeNewPatient);
  document.getElementById('new-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('new-modal')) closeNewPatient();
  });
  document.getElementById('new-modal-submit').addEventListener('click', submitNewPatient);

  ['np-nombre','np-edad','np-motivo'].forEach(id => {
    document.getElementById(id).addEventListener('input', checkNewForm);
  });

  document.querySelectorAll('#np-triage-btns .triage-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      npTriage = parseInt(btn.dataset.t);
      document.querySelectorAll('#np-triage-btns .triage-btn').forEach(b => {
        b.className = 'triage-btn' + (parseInt(b.dataset.t) === npTriage ? ` sel-${npTriage}` : '');
      });
    });
  });

});
