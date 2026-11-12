/* ============================================================
   URGENCIAS — Front-end conectado a MySQL vía API (/api/*)
   - Login con usuario + contraseña (tabla medicos)
   - Dar de alta / eliminar pacientes
   - Edición de signos vitales
   - Datos vía INNER JOIN: sala_medica + medicos + estados
   ============================================================ */
'use strict';

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

let state = {
  doctor: null,          // nombre del médico (viene del login)
  usuario: null,         // usuario del médico (para las FK en el servidor)
  patients: [],
  medicos: [],
  filterTriage: 0,
  filterStatus: 'todos',
  search: '',
  editingDetail: false,
  openPatientId: null,
};

// ── Capa de datos: API ↔ MySQL ────────────────────────────────────────────────

async function api(ruta, opciones) {
  const res = await fetch(ruta, opciones);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Error del servidor');
  }
  return res.json();
}

// Normaliza una fila del INNER JOIN al formato que usa la interfaz
function normalizar(fila) {
  const hoy = new Date();
  const [h, m] = String(fila.hora_ingreso).slice(0, 8).split(':');
  const llegada = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), +h, +m);
  return {
    id: fila.id,
    folio: fila.folio,
    nombre: fila.nombre,
    edad: fila.edad,
    sexo: fila.sexo,
    triage: fila.triage,
    motivoConsulta: fila.motivoConsulta,
    llegada,
    doctor: fila.doctor,
    status: fila.status,
    presionArterial: fila.ta,
    frecuenciaCardiaca: fila.fc,
    temperatura: parseFloat(fila.temperatura),
    saturacion: fila.spo2,
    notas: fila.notas || '',
  };
}

async function cargarPacientes() {
  const filas = await api('/api/pacientes');
  state.patients = filas.map(normalizar);
  render();
}

async function cargarMedicos() {
  const filas = await api('/api/pacientes'); // el JOIN ya trae el nombre de cada médico
  state.medicos = [...new Set(filas.map(f => f.doctor))];
}

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

function findPatient(id) {
  return state.patients.find(x => String(x.id) === String(id));
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
  const p = findPatient(id);
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

  // Vitals (vista)
  const taVal = parseInt(p.presionArterial);
  document.getElementById('detail-vitals').innerHTML =
    vital_chip('TA',   p.presionArterial, 'mmHg', taVal >= 160) +
    vital_chip('FC',   p.frecuenciaCardiaca, 'lpm', p.frecuenciaCardiaca > 100 || p.frecuenciaCardiaca < 50) +
    vital_chip('Temp', p.temperatura.toFixed(1), '°C', p.temperatura >= 38.5) +
    vital_chip('SpO₂', p.saturacion, '%', p.saturacion < 94) +
    vital_chip('Espera', fmtWait(p.llegada), '');

  // Vitals (edición)
  document.getElementById('detail-ta').value   = p.presionArterial === '—' ? '' : p.presionArterial;
  document.getElementById('detail-fc').value   = p.frecuenciaCardiaca || '';
  document.getElementById('detail-temp').value = p.temperatura || '';
  document.getElementById('detail-spo2').value = p.saturacion || '';

  // Médico
  document.getElementById('detail-doctor-view').innerHTML = p.doctor || '<em style="color:var(--text3)">Sin asignar</em>';
  const docSel = document.getElementById('detail-doctor-edit');
  docSel.innerHTML = `<option value="${state.doctor}">${state.doctor} (tú)</option>
    ${state.medicos.filter(d => d !== state.doctor).map(d => `<option value="${d}">${d}</option>`).join('')}`;
  docSel.value = p.doctor || state.doctor;

  // Status
  document.getElementById('detail-status-view').innerHTML = status_badge(p.status);
  document.getElementById('detail-status-edit').value = p.status;

  // Notas
  document.getElementById('detail-notas-view').innerHTML = p.notas
    ? p.notas
    : '<em style="color:var(--text3)">Sin notas registradas</em>';
  document.getElementById('detail-notas-edit').value = p.notas;

  // Botón "Dar de alta": solo si no está ya dado de alta / transferido
  const puedeAlta = p.status !== 'alta' && p.status !== 'transferido';
  document.getElementById('detail-alta-btn').classList.toggle('hidden', !puedeAlta);
  document.getElementById('detail-delete-btn').classList.remove('hidden');
}

function setDetailEditMode(editing) {
  state.editingDetail = editing;
  const views  = ['detail-doctor-view','detail-status-view','detail-notas-view'];
  const edits  = ['detail-doctor-edit','detail-status-edit','detail-notas-edit'];
  views.forEach(id => document.getElementById(id).classList.toggle('hidden', editing));
  edits.forEach(id => document.getElementById(id).classList.toggle('hidden', !editing));
  document.getElementById('vitals-edit').classList.toggle('hidden', !editing);
  document.getElementById('detail-vitals').classList.toggle('hidden', editing);
  document.getElementById('detail-cancel-btn').textContent = editing ? 'Cancelar' : 'Cerrar';
  document.getElementById('detail-edit-btn').classList.toggle('hidden', editing);
  document.getElementById('detail-alta-btn').classList.toggle('hidden', editing);
  document.getElementById('detail-delete-btn').classList.toggle('hidden', editing);
  document.getElementById('detail-save-btn').classList.toggle('hidden', !editing);
}

// Guarda en MySQL: médico (FK), estado (FK), notas y SIGNOS VITALES
async function saveDetail() {
  const p = findPatient(state.openPatientId);
  if (!p) return;
  const payload = {
    doctor: document.getElementById('detail-doctor-edit').value || state.doctor,
    usuario: state.usuario,
    status: document.getElementById('detail-status-edit').value,
    notas:  document.getElementById('detail-notas-edit').value,
    ta:   document.getElementById('detail-ta').value.trim(),
    fc:   parseInt(document.getElementById('detail-fc').value) || 0,
    temperatura: parseFloat(document.getElementById('detail-temp').value) || 36.5,
    spo2: parseInt(document.getElementById('detail-spo2').value) || 98,
  };
  try {
    await api('/api/pacientes/' + p.id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    await cargarPacientes();           // recarga desde la BD (JOIN actualizado)
    populateDetail(findPatient(p.id));
    setDetailEditMode(false);
  } catch (e) {
    alert('No se pudieron guardar los cambios: ' + e.message);
  }
}

// DAR DE ALTA: cambia el estado a "alta" sin borrar el registro
async function darDeAlta() {
  const p = findPatient(state.openPatientId);
  if (!p) return;
  if (!confirm(`¿Dar de alta a ${p.nombre}?`)) return;
  try {
    await api('/api/pacientes/' + p.id + '/alta', { method: 'PUT' });
    await cargarPacientes();
    populateDetail(findPatient(p.id));
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

// ELIMINAR: borra el registro de la tabla sala_medica
async function eliminarPaciente() {
  const p = findPatient(state.openPatientId);
  if (!p) return;
  if (!confirm(`¿ELIMINAR el registro de ${p.nombre}?\nEsta acción no se puede deshacer.`)) return;
  try {
    await api('/api/pacientes/' + p.id, { method: 'DELETE' });
    closeDetail();
    await cargarPacientes();
  } catch (e) {
    alert('Error: ' + e.message);
  }
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

// Inserta en sala_medica con las FKs (médico del login, estado "en_espera")
async function submitNewPatient() {
  const nombre = document.getElementById('np-nombre').value.trim();
  const edad   = parseInt(document.getElementById('np-edad').value);
  const sexo   = document.getElementById('np-sexo').value;
  const motivo = document.getElementById('np-motivo').value.trim();
  if (!nombre || !edad || !motivo) return;

  try {
    await api('/api/pacientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre, edad, sexo, triage: npTriage, motivo,
        doctor: state.doctor, usuario: state.usuario,
      }),
    });
    closeNewPatient();
    await cargarPacientes();
    await cargarMedicos();
  } catch (e) {
    alert('No se pudo registrar el ingreso: ' + e.message);
  }
}

// ── Login ─────────────────────────────────────────────────────────────────────

async function showDashboard(nombre, usuario) {
  state.doctor = nombre;
  state.usuario = usuario;
  document.getElementById('login-screen').classList.remove('active');
  document.getElementById('dashboard-screen').classList.add('active');
  document.getElementById('doctor-name').textContent = nombre;
  document.getElementById('doctor-avatar').textContent = initials(nombre);
  tick();
  try {
    await cargarMedicos();
    await cargarPacientes();
    setInterval(cargarPacientes, 15000);     // refresco automático silencioso
  } catch (e) {
    alert('No se pudo conectar con la base de datos. ¿MySQL encendido y "sala_medica.sql" importado?');
  }
}

function logout() {
  state.doctor = null;
  state.usuario = null;
  state.patients = [];
  document.getElementById('dashboard-screen').classList.remove('active');
  document.getElementById('login-screen').classList.add('active');
  document.getElementById('login-usuario').value = '';
  document.getElementById('login-clave').value = '';
  document.getElementById('login-btn').disabled = true;
}

// ── Registro de médicos ───────────────────────────────────────────────────────

function mostrarRegistro(mostrar) {
  document.getElementById('login-head').classList.toggle('hidden', mostrar);
  document.getElementById('login-form').classList.toggle('hidden', mostrar);
  document.getElementById('register-head').classList.toggle('hidden', !mostrar);
  document.getElementById('register-form').classList.toggle('hidden', !mostrar);
  document.getElementById('reg-msg').classList.add('hidden');
}

// ── Boot & events ─────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {

  document.getElementById('login-date').textContent = fmtDate(new Date());

  // LOGIN con usuario + contraseña
  const loginUsuario = document.getElementById('login-usuario');
  const loginClave   = document.getElementById('login-clave');
  const loginBtn     = document.getElementById('login-btn');

  function checkLogin() {
    loginBtn.disabled = !(loginUsuario.value.trim() && loginClave.value.trim());
  }
  loginUsuario.addEventListener('input', checkLogin);
  loginClave.addEventListener('input', checkLogin);

  document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      const data = await api('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usuario: loginUsuario.value.trim(),
          clave:   loginClave.value,
        }),
      });
      showDashboard(data.nombre, data.usuario);
    } catch (err) {
      alert(err.message);
    }
  });

  // REGISTRO
  const regNombre  = document.getElementById('reg-nombre');
  const regUsuario = document.getElementById('reg-usuario');
  const regClave   = document.getElementById('reg-clave');
  const regClave2  = document.getElementById('reg-clave2');
  const regBtn     = document.getElementById('reg-btn');
  const regMsg     = document.getElementById('reg-msg');

  function checkRegistro() {
    regBtn.disabled = !(regNombre.value.trim() && regUsuario.value.trim() &&
                        regClave.value && regClave2.value);
  }
  [regNombre, regUsuario, regClave, regClave2].forEach(i => i.addEventListener('input', checkRegistro));

  document.getElementById('show-register').addEventListener('click', () => mostrarRegistro(true));
  document.getElementById('show-login').addEventListener('click', () => mostrarRegistro(false));

  function regError(texto) {
    regMsg.textContent = texto;
    regMsg.classList.remove('hidden');
  }

  document.getElementById('register-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (regClave.value.length < 6) return regError('La contraseña debe tener al menos 6 caracteres');
    if (regClave.value !== regClave2.value) return regError('Las contraseñas no coinciden');
    regBtn.disabled = true;
    try {
      const data = await api('/api/registro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre:  regNombre.value.trim(),
          usuario: regUsuario.value.trim(),
          clave:   regClave.value,
        }),
      });
      // Cuenta creada: volver al login con el usuario ya escrito
      e.target.reset();
      mostrarRegistro(false);
      loginUsuario.value = data.usuario;
      loginClave.value = '';
      checkLogin();
      loginClave.focus();
      alert('Cuenta creada correctamente. Ya puedes iniciar sesión.');
    } catch (err) {
      regError(err.message);
    } finally {
      checkRegistro();
    }
  });

  // Logout
  document.getElementById('btn-logout').addEventListener('click', logout);

  // Search
  document.getElementById('search-input').addEventListener('input', e => {
    state.search = e.target.value;
    renderTable();
  });

  // New patient
  document.getElementById('btn-new-patient').addEventListener('click', openNewPatient);

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
    setDetailEditMode(true);
  });
  document.getElementById('detail-save-btn').addEventListener('click', saveDetail);
  document.getElementById('detail-alta-btn').addEventListener('click', darDeAlta);
  document.getElementById('detail-delete-btn').addEventListener('click', eliminarPaciente);
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
