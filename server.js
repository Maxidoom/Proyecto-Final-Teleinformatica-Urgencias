
const express = require('express');
const path = require('path');
const crypto = require('crypto');
const conexion = require('./conexion');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ejecuta consulta y devuelve promesa 
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    conexion.query(sql, params, (err, filas) => {
      if (err) reject(err);
      else resolve(filas);
    });
  });
}

//contraseñas
function hashClave(clave) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(clave, salt, 64).toString('hex');
  return salt + ':' + hash;
}

function verificarClave(clave, guardada) {
  const [salt, hash] = (guardada || '').split(':');
  if (!salt || !hash) return false;
  const prueba = crypto.scryptSync(clave, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(prueba, 'hex'));
}

//  login y registro
app.post('/api/login', async (req, res) => {
  const { usuario, clave } = req.body;
  if (!usuario || !clave) return res.status(400).json({ error: 'Completa usuario y contraseña' });

  try {
    const filas = await query(
      'SELECT id_medico, nombre, usuario, clave FROM medicos WHERE usuario = ? AND activo = 1', [usuario]);
    const m = filas[0];
    if (!m || !verificarClave(clave, m.clave)) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    }
    res.json({ id: m.id_medico, nombre: m.nombre, usuario: m.usuario });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/registro', async (req, res) => {
  const nombre = String(req.body.nombre || '').trim();
  const usuario = String(req.body.usuario || '').trim().toLowerCase();
  const clave = String(req.body.clave || '');

  if (!nombre || !usuario || !clave) return res.status(400).json({ error: 'Completa todos los campos' });
  if (usuario.length < 3) return res.status(400).json({ error: 'El usuario debe tener al menos 3 caracteres' });
  if (clave.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

  try {
    const existe = await query('SELECT 1 FROM medicos WHERE usuario = ?', [usuario]);
    if (existe.length > 0) return res.status(409).json({ error: 'Ese usuario ya está en uso' });

    await query('INSERT INTO medicos (nombre, usuario, clave) VALUES (?, ?, ?)', [nombre, usuario, hashClave(clave)]);
    res.status(201).json({ usuario });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

//medicos
// médicos activos 
app.get('/api/medicos', async (req, res) => {
  try {
    res.json(await query('SELECT id_medico, nombre FROM medicos WHERE activo = 1 ORDER BY nombre'));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

//pacientes
// Revisar los datos de un paciente
function errorPaciente(d) {
  if (!d.nombre || !d.edad || !d.motivo) return 'Nombre, edad y motivo son obligatorios';
  if (d.triage < 1 || d.triage > 5) return 'El triage debe ser de 1 a 5';
  if (d.sexo !== 'M' && d.sexo !== 'F') return 'Sexo no válido';
  if (!d.id_medico) return 'Falta el médico';
  return null;
}

// Listar pacientes
app.get('/api/pacientes', async (req, res) => {
  try {
    const filas = await query(`
      SELECT s.pacient_id AS id, s.folio, s.nombre, s.edad, s.sexo, s.triage,
             s.motivo_consulta AS motivo, s.notas, s.hora_ingreso,
             s.id_medico, m.nombre AS doctor,
             e.codigo AS status, e.nombre AS statusNombre
      FROM sala_medica s
      INNER JOIN medicos m ON m.id_medico = s.id_medico
      INNER JOIN estados e ON e.id_estado = s.id_estado
      ORDER BY s.triage ASC, s.hora_ingreso ASC`);
    res.json(filas);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Nuevo paciente
app.post('/api/pacientes', async (req, res) => {
  const d = req.body;
  const error = errorPaciente(d);
  if (error) return res.status(400).json({ error });

  try {
    // guarda folio temporal 
    const temporal = Date.now().toString(36);
    const r = await query(
      `INSERT INTO sala_medica
         (folio, nombre, edad, sexo, triage, motivo_consulta, notas, hora_ingreso, id_medico, id_estado)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURTIME(), ?, (SELECT id_estado FROM estados WHERE codigo = ?))`,
      [temporal, d.nombre, d.edad, d.sexo, d.triage, d.motivo, d.notas || '', d.id_medico, d.status || 'en_espera']);

    // folio posta
    await query("UPDATE sala_medica SET folio = CONCAT('URG-', LPAD(?, 4, '0')) WHERE pacient_id = ?", [r.insertId, r.insertId]);
    res.status(201).json({ id: r.insertId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Editar paciente
app.put('/api/pacientes/:id', async (req, res) => {
  const d = req.body;
  const error = errorPaciente(d);
  if (error) return res.status(400).json({ error });

  try {
    await query(
      `UPDATE sala_medica
       SET nombre = ?, edad = ?, sexo = ?, triage = ?, motivo_consulta = ?, notas = ?,
           id_medico = ?, id_estado = (SELECT id_estado FROM estados WHERE codigo = ?)
       WHERE pacient_id = ?`,
      [d.nombre, d.edad, d.sexo, d.triage, d.motivo, d.notas || '', d.id_medico, d.status, req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Dar de alta 
app.put('/api/pacientes/:id/alta', async (req, res) => {
  try {
    await query(
      "UPDATE sala_medica SET id_estado = (SELECT id_estado FROM estados WHERE codigo = 'alta') WHERE pacient_id = ?",
      [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Eliminar paciente
app.delete('/api/pacientes/:id', async (req, res) => {
  try {
    await query('DELETE FROM sala_medica WHERE pacient_id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(3000, () => {
  console.log('Urgencias corriendo en http://localhost:3000');
});