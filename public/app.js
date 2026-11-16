
let medico = null;        // médico que inició sesión: { id, nombre, usuario }
let pacientes = [];       // lista de pacientes que llega del servidor
let idEditando = null;    // id del paciente abierto (null = paciente nuevo)
let triage = 3;           // nivel de triage elegido en la ventana

function $(id) {
  return document.getElementById(id);
}

// Muestra (si = true) u oculta (si = false) un elemento
function mostrar(id, si) {
  $(id).classList.toggle('hidden', !si);
}

// Evita que un texto escrito por el usuario rompa el HTML
function limpiar(texto) {
  return String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Llama al servidor y devuelve la respuesta en JSON
async function api(ruta, metodo, datos) {
  const opciones = { method: metodo || 'GET', headers: { 'Content-Type': 'application/json' } };
  if (datos) opciones.body = JSON.stringify(datos);

  const respuesta = await fetch(ruta, opciones);
  const json = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) throw new Error(json.error || 'Error del servidor (código ' + respuesta.status + ')');
  return json;
}

//Login, registro y salir 
function verRegistro(si) {
  mostrar('login-head', !si);
  mostrar('login-form', !si);
  mostrar('registro-head', si);
  mostrar('registro-form', si);
  mostrar('reg-msg', false);
}

async function iniciarSesion(e) {
  e.preventDefault();
  try {
    medico = await api('/api/login', 'POST', {
      usuario: $('login-usuario').value.trim(),
      clave: $('login-clave').value,
    });
    entrarAlPanel();
  } catch (err) {
    alert(err.message);
  }
}

async function crearCuenta(e) {
  e.preventDefault();
  if ($('reg-clave').value !== $('reg-clave2').value) {
    $('reg-msg').textContent = 'Las contraseñas no coinciden';
    mostrar('reg-msg', true);
    return;
  }
  try {
    const datos = await api('/api/registro', 'POST', {
      nombre: $('reg-nombre').value.trim(),
      usuario: $('reg-usuario').value.trim(),
      clave: $('reg-clave').value,
    });
    // vuelve al login con el usuario ya escrito
    $('registro-form').reset();
    verRegistro(false);
    $('login-usuario').value = datos.usuario;
    $('login-clave').value = '';
    $('login-clave').focus();
    alert('Cuenta creada. Ya puedes iniciar sesión.');
  } catch (err) {
    $('reg-msg').textContent = err.message;
    mostrar('reg-msg', true);
  }
}

function salir() {
  medico = null;
  pacientes = [];
  $('login-form').reset();
  $('dashboard-screen').classList.remove('active');
  $('login-screen').classList.add('active');
}

// Panel principal
async function entrarAlPanel() {
  $('login-screen').classList.remove('active');
  $('dashboard-screen').classList.add('active');
  $('doctor-name').textContent = medico.nombre;

  try {
    await cargarMedicos();
    await cargarPacientes();
  } catch (err) {
    alert('No se pudo conectar con la base de datos: ' + err.message);
  }
}

// Llena el selector de médicos de la ventana
async function cargarMedicos() {
  const lista = await api('/api/medicos');
  let opciones = '';
  for (const m of lista) {
    opciones += '<option value="' + m.id_medico + '">' + limpiar(m.nombre) + '</option>';
  }
  $('p-medico').innerHTML = opciones;
}

// Pide los pacientes al servidor 
async function cargarPacientes() {
  pacientes = await api('/api/pacientes');
  dibujar();
}

// Aplica los filtros y dibuja contadores y tabla
function dibujar() {
  // Contadores (usan todos los pacientes, sin filtrar)
  const activos = pacientes.filter(p => p.status !== 'alta' && p.status !== 'transferido');
  $('stat-total').textContent = activos.length;
  $('stat-espera').textContent = pacientes.filter(p => p.status === 'en_espera').length;
  $('stat-atencion').textContent = pacientes.filter(p => p.status === 'en_atencion').length;
  $('stat-criticos').textContent = activos.filter(p => p.triage <= 2).length;

  // Filtros
  const texto = $('buscar').value.toLowerCase();
  const filtroTriage = $('filtro-triage').value;     
  const filtroEstado = $('filtro-estado').value;    

  const lista = pacientes.filter(p =>
    (filtroTriage === '' || p.triage === Number(filtroTriage)) &&
    (filtroEstado === '' || p.status === filtroEstado) &&
    (p.nombre.toLowerCase().includes(texto) || p.folio.toLowerCase().includes(texto))
  );

  $('results-count').textContent = lista.length + (lista.length === 1 ? ' resultado' : ' resultados');
  mostrar('sin-resultados', lista.length === 0);

  // Una fila por paciente
  let filas = '';
  for (const p of lista) {
    filas += `<tr onclick="abrirModal(${p.id})">
      <td><span class="mono" style="font-size:.72rem;color:var(--text3)">${limpiar(p.folio)}</span></td>
      <td style="font-weight:500">${limpiar(p.nombre)}</td>
      <td>${p.edad} <span style="font-size:.72rem;color:var(--text3)">${p.sexo}</span></td>
      <td><span class="triage-badge t${p.triage}"><span class="dot"></span>T${p.triage}</span></td>
      <td style="max-width:240px"><p class="truncate" style="color:#cbd5e1">${limpiar(p.motivo)}</p></td>
      <td><span class="mono" style="font-size:.72rem;color:var(--text3)">${String(p.hora_ingreso).slice(0, 5)}</span></td>
      <td style="font-size:.78rem;color:var(--text2)">${limpiar(p.doctor)}</td>
      <td><span class="status-badge s-${p.status}">${p.statusNombre}</span></td>
    </tr>`;
  }
  $('tabla').innerHTML = filas;
}

// Ventana de paciente (sirve para nuevo y para editar) 
function elegirTriage(n) {
  triage = n;
  for (const boton of document.querySelectorAll('#p-triage .triage-btn')) {
    boton.className = 'triage-btn';
    if (Number(boton.dataset.t) === n) boton.className = 'triage-btn sel-' + n;
  }
}

// 
function abrirModal(id) {
  const p = pacientes.find(x => x.id === id);   // undefined si es nuevo
  idEditando = p ? p.id : null;

  $('modal-titulo').textContent = p ? 'Editar paciente · ' + p.folio : 'Nuevo ingreso';
  $('p-nombre').value = p ? p.nombre : '';
  $('p-edad').value = p ? p.edad : '';
  $('p-sexo').value = p ? p.sexo : 'M';
  $('p-motivo').value = p ? p.motivo : '';
  $('p-notas').value = p ? (p.notas || '') : '';
  $('p-medico').value = p ? p.id_medico : medico.id;
  $('p-estado').value = p ? p.status : 'en_espera';
  elegirTriage(p ? p.triage : 3);

  // "Eliminar" y "Dar de alta" solo existen al editar
  mostrar('btn-eliminar', !!p);
  mostrar('btn-alta', !!p && p.status !== 'alta');
  mostrar('modal', true);
}

function cerrarModal() {
  mostrar('modal', false);
}

async function guardarPaciente(e) {
  e.preventDefault();
  const datos = {
    nombre: $('p-nombre').value.trim(),
    edad: Number($('p-edad').value),
    sexo: $('p-sexo').value,
    triage: triage,
    motivo: $('p-motivo').value.trim(),
    notas: $('p-notas').value.trim(),
    id_medico: Number($('p-medico').value),
    status: $('p-estado').value,
  };

  try {
    if (idEditando) await api('/api/pacientes/' + idEditando, 'PUT', datos);
    else await api('/api/pacientes', 'POST', datos);
    cerrarModal();
    await cargarPacientes();
  } catch (err) {
    alert('No se pudo guardar: ' + err.message);
  }
}

async function darDeAlta() {
  if (!confirm('¿Dar de alta a este paciente?')) return;
  try {
    await api('/api/pacientes/' + idEditando + '/alta', 'PUT');
    cerrarModal();
    await cargarPacientes();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function eliminarPaciente() {
  if (!confirm('¿Eliminar este registro? No se puede deshacer.')) return;
  try {
    await api('/api/pacientes/' + idEditando, 'DELETE');
    cerrarModal();
    await cargarPacientes();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

// Conectar cada botón con su función 
// Login y registro
$('login-form').addEventListener('submit', iniciarSesion);
$('registro-form').addEventListener('submit', crearCuenta);
$('ir-registro').addEventListener('click', () => verRegistro(true));
$('ir-login').addEventListener('click', () => verRegistro(false));
$('btn-logout').addEventListener('click', salir);

// cualquier cambio vuelve a dibujar la tabla
$('buscar').addEventListener('input', dibujar);
$('filtro-triage').addEventListener('change', dibujar);
$('filtro-estado').addEventListener('change', dibujar);

// Ventana de paciente
$('btn-nuevo').addEventListener('click', () => abrirModal());
$('modal-cerrar').addEventListener('click', cerrarModal);
$('btn-cancelar').addEventListener('click', cerrarModal);
$('form-paciente').addEventListener('submit', guardarPaciente);
$('btn-alta').addEventListener('click', darDeAlta);
$('btn-eliminar').addEventListener('click', eliminarPaciente);
for (const boton of document.querySelectorAll('#p-triage .triage-btn')) {
  boton.addEventListener('click', () => elegirTriage(Number(boton.dataset.t)));
}