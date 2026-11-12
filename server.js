// ============================================================
//  URGENCIAS - Servidor Express + MySQL (usa ./conexion.js)
//  Uso:  npm install   →   npm start   (puerto 3000)
// ============================================================
const express = require('express');
const path = require('path');
const crypto = require('crypto');        // para hashear claves sin instalar nada
const conexion = require('./conexion');  // tu archivo de conexión (mysql2)

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Promesas sobre tu conexion mysql2
const query = (sql, params = []) =>
  new Promise((resolve, reject) =>
    conexion.query(sql, params, (err, rows) => err ? reject(err) : resolve(rows)));

// ---------- Hash de claves (crypto.scrypt, sin dependencias nuevas) ----------
function hashClave(clave) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(clave, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}
function verificarClave(clave, guardada) {
  const [salt, hash] = (guardada || '').split(':');
  if (!salt || !hash) return false;
  const prueba = crypto.scryptSync(clave, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(prueba, 'hex'));
}

// ------------------------------------------------------------
// CONSULTA RELACIONAL: INNER JOINs de sala_medica + medicos + estados
// ------------------------------------------------------------
const PACIENTES_JOIN = `
  SELECT
    s.pacient_id AS id, s.folio, s.nombre, s.edad, s.sexo,
    s.triage, s.motivo_consulta AS motivoConsulta,
    s.ta, s.fc, s.temperatura, s.spo2, s.notas,
    s.hora_ingreso,
    TIMESTAMPDIFF(MINUTE, s.hora_ingreso, CURTIME()) AS t_espera,
    m.nombre AS doctor, m.usuario AS medicoUsuario,
    e.codigo AS status, e.nombre AS statusNombre
  FROM sala_medica s
  INNER JOIN medicos m ON m.id_medico = s.id_medico   -- FK -> PK
  INNER JOIN estados e ON e.id_estado = s.id_estado   -- FK -> PK
  ORDER BY s.triage ASC, s.hora_ingreso ASC`;

// ---------- API ----------

// LOGIN: valida usuario + clave contra la tabla medicos
app.post('/api/login', async (req, res) => {
  const { usuario, clave } = req.body;
  if (!usuario || !clave) return res.status(400).json({ error: 'Completa usuario y contraseña' });
  try {
    const rows = await query('SELECT nombre, usuario, clave FROM medicos WHERE usuario = ? AND activo = 1', [usuario]);
    const m = rows[0];
    if (!m || !verificarClave(clave, m.clave)) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }
    res.json({ ok: true, nombre: m.nombre, usuario: m.usuario });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/registro', async (req, res) => {
  const nombre  = String(req.body.nombre || '').trim();
  const usuario = String(req.body.usuario || '').trim().toLowerCase();
  const clave   = String(req.body.clave || '');

  if (!nombre || !usuario || !clave) return res.status(400).json({ error: 'Completa todos los campos' });
  if (nombre.length > 60) return res.status(400).json({ error: 'El nombre es demasiado largo (máx. 60)' });
  if (!/^[a-z0-9._-]{3,40}$/.test(usuario)) {
    return res.status(400).json({ error: 'Usuario: 3 a 40 caracteres (letras, números, . _ -)' });
  }
  if (clave.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

  try {
    const existe = await query('SELECT 1 FROM medicos WHERE usuario = ?', [usuario]);
    if (existe.length) return res.status(409).json({ error: 'Ese usuario ya está en uso' });

    await query('INSERT INTO medicos (nombre, usuario, clave) VALUES (?, ?, ?)',
                [nombre, usuario, hashClave(clave)]);
    res.status(201).json({ ok: true, usuario });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ese usuario ya está en uso' });
    res.status(500).json({ error: e.message });
  }
});
// Cambiar clave (opcional, para el médico logueado)
app.put('/api/medicos/clave', async (req, res) => {
  const { usuario, claveNueva } = req.body;
  if (!usuario || !claveNueva) return res.status(400).json({ error: 'Datos incompletos' });
  try {
    await query('UPDATE medicos SET clave = ? WHERE usuario = ?', [hashClave(claveNueva), usuario]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Listar pacientes (INNER JOIN)
app.get('/api/pacientes', async (req, res) => {
  try {
    res.json(await query(PACIENTES_JOIN));
  } catch (e) {
    res.status(500).json({ error: 'Error al consultar pacientes', detalle: e.message });
  }
});

// Nuevo ingreso (inserta en tu tabla sala_medica con las FKs)
app.post('/api/pacientes', async (req, res) => {
  const { nombre, edad, sexo, triage, motivo, doctor, usuario } = req.body;
  if (!nombre || !edad || !motivo) {
    return res.status(400).json({ error: 'Nombre, edad y motivo son obligatorios' });
  }
  try {
    // Medico responsable (FK): se busca por usuario logueado o por nombre
    let med = await query('SELECT id_medico FROM medicos WHERE usuario = ?', [usuario || '']);
    if (!med.length) med = await query('SELECT id_medico FROM medicos WHERE nombre = ?', [doctor || '']);
    if (!med.length) return res.status(400).json({ error: 'Médico no encontrado. Iniciá sesión de nuevo.' });

    const est = await query("SELECT id_estado FROM estados WHERE codigo = 'en_espera'");

    const r = await query(
      `INSERT INTO sala_medica
         (folio, nombre, edad, sexo, triage, motivo_consulta,
          hora_ingreso, t_espera, id_medico, id_estado)
       VALUES ('TMP', ?, ?, ?, ?, ?, CURTIME(), 0, ?, ?)`,
      [nombre, edad, sexo, triage, motivo, med[0].id_medico, est[0].id_estado]);
    const id = r.insertId;

    // Folio real a partir del PK: URG-0001, URG-0002, ...
    await query("UPDATE sala_medica SET folio = CONCAT('URG-', LPAD(?, 4, '0')) WHERE pacient_id = ?", [id, id]);
    res.status(201).json({ ok: true, id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Actualizar: médico (FK), estado (FK), notas Y SIGNOS VITALES
app.put('/api/pacientes/:id', async (req, res) => {
  const id = req.params.id;
  const { doctor, usuario, status, notas, ta, fc, temperatura, spo2 } = req.body;
  try {
    let med = await query('SELECT id_medico FROM medicos WHERE usuario = ?', [usuario || '']);
    if (!med.length) med = await query('SELECT id_medico FROM medicos WHERE nombre = ?', [doctor || '']);
    if (!med.length) return res.status(400).json({ error: 'Médico no encontrado' });

    const est = await query('SELECT id_estado FROM estados WHERE codigo = ?', [status]);

    await query(
      `UPDATE sala_medica
       SET id_medico = ?, id_estado = ?, notas = ?,
           ta = ?, fc = ?, temperatura = ?, spo2 = ?,
           t_espera = TIMESTAMPDIFF(MINUTE, hora_ingreso, CURTIME())
       WHERE pacient_id = ?`,
      [med[0].id_medico, est[0].id_estado, notas || '',
       ta || '—', fc || 0, temperatura || 36.5, spo2 || 98, id]);

    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DAR DE ALTA: atajo para cambiar el estado a "alta"
app.put('/api/pacientes/:id/alta', async (req, res) => {
  try {
    const est = await query("SELECT id_estado FROM estados WHERE codigo = 'alta'");
    await query('UPDATE sala_medica SET id_estado = ? WHERE pacient_id = ?', [est[0].id_estado, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ELIMINAR paciente del registro
app.delete('/api/pacientes/:id', async (req, res) => {
  try {
    await query('DELETE FROM sala_medica WHERE pacient_id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => {
  console.log(`Urgencias corriendo en http://localhost:${PORT}`);
  console.log('  (conectado a MySQL: base "urgencias" - tabla sala_medica)');
});
