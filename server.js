const express = require('express');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function toInt(v, fallback) {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? fallback : n;
}

// GET 
app.get('/students', (req, res) => {
  let students = db.getStudents();

  const q = (req.query.q || '').toLowerCase().trim();
  const course = (req.query.course || '').trim();
  const sort = req.query.sort || 'name';
  const order = (req.query.order || 'asc').toLowerCase();
  const page = toInt(req.query.page, 1);
  const limit = toInt(req.query.limit, 8);

  if (q) {
    students = students.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.rollNumber || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q) ||
      (s.course || '').toLowerCase().includes(q)
    );
  }

  if (course) {
    students = students.filter(s => (s.course || '') === course);
  }

  students.sort((a, b) => {
    let A = a[sort];
    let B = b[sort];
    if (sort === 'admissionDate') {
      A = new Date(A || 0).getTime();
      B = new Date(B || 0).getTime();
    }
    if (typeof A === 'string') A = A.toLowerCase();
    if (typeof B === 'string') B = B.toLowerCase();

    if (A < B) return order === 'asc' ? -1 : 1;
    if (A > B) return order === 'asc' ? 1 : -1;
    return 0;
  });

  const total = students.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const p = Math.min(Math.max(1, page), totalPages);
  const start = (p - 1) * limit;
  const data = students.slice(start, start + limit);

  res.json({ data, total, page: p, limit, totalPages });
});

// GET 
app.get('/students/:id', (req, res) => {
  const s = db.findStudent(req.params.id);
  if (!s) return res.status(404).json({ error: 'Student not found' });
  res.json(s);
});

// POST 
app.post('/students', (req, res) => {
  const body = req.body || {};
  const required = ['rollNumber', 'name', 'email', 'course'];
  for (const f of required) {
    if (!body[f] || String(body[f]).trim() === '') {
      return res.status(400).json({ error: `${f} is required` });
    }
  }

  if (db.findByRoll(body.rollNumber)) {
    return res.status(400).json({ error: 'rollNumber already exists' });
  }
  if (db.findByEmail(body.email)) {
    return res.status(400).json({ error: 'email already exists' });
  }

  const student = db.addStudent({
    rollNumber: String(body.rollNumber).trim(),
    name: String(body.name).trim(),
    email: String(body.email).trim(),
    phone: body.phone || '',
    age: body.age || '',
    course: String(body.course).trim(),
    address: body.address || '',
    admissionDate: body.admissionDate || new Date().toISOString(),
    gender: body.gender || 'Other',
    status: body.status || 'Active',
    avatarUrl: body.avatarUrl || ''
  });

  res.status(201).json(student);
});

// PUT 
app.put('/students/:id', (req, res) => {
  const id = req.params.id;
  const old = db.findStudent(id);
  if (!old) return res.status(404).json({ error: 'Student not found' });

  const body = req.body || {};
  if (body.rollNumber && body.rollNumber !== old.rollNumber) {
    if (db.findByRoll(body.rollNumber)) {
      return res.status(400).json({ error: 'rollNumber already exists' });
    }
  }
  if (body.email && body.email !== old.email) {
    if (db.findByEmail(body.email)) {
      return res.status(400).json({ error: 'email already exists' });
    }
  }

  const updated = db.updateStudent(id, {
    rollNumber: body.rollNumber,
    name: body.name,
    email: body.email,
    phone: body.phone,
    age: body.age,
    course: body.course,
    address: body.address,
    admissionDate: body.admissionDate,
    gender: body.gender,
    status: body.status,
    avatarUrl: body.avatarUrl
  });

  res.json(updated);
});

// DELETE
app.delete('/students/:id', (req, res) => {
  const ok = db.deleteStudent(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Student not found' });
  res.status(204).send();
});

// IMPORT
app.post('/students/import', (req, res) => {
  const arr = (req.body && req.body.students) || [];
  if (!Array.isArray(arr)) return res.status(400).json({ error: 'students must be an array' });

  const result = { added: 0, skipped: 0, errors: [] };
  for (const item of arr) {
    try {
      if (!item.rollNumber || !item.name || !item.email || !item.course) {
        result.skipped++;
        continue;
      }
      if (db.findByRoll(item.rollNumber) || db.findByEmail(item.email)) {
        result.skipped++;
        continue;
      }
      db.addStudent({
        rollNumber: String(item.rollNumber),
        name: String(item.name),
        email: String(item.email),
        phone: item.phone || '',
        age: item.age || '',
        course: String(item.course) || '',
        address: item.address || '',
        admissionDate: item.admissionDate || new Date().toISOString(),
        gender: item.gender || 'Other',
        status: item.status || 'Active',
        avatarUrl: item.avatarUrl || ''
      });
      result.added++;
    } catch (e) {
      result.errors.push({ item, error: String(e) });
    }
  }
  res.json(result);
});

// EXPORT CSV
app.get('/students/export', (req, res) => {
  const students = db.getStudents();
  const headers = ['id','rollNumber','name','email','phone','age','course','address','admissionDate','gender','status','avatarUrl','createdAt','updatedAt'];
  const rows = students.map(s => headers.map(h => {
    const v = s[h] == null ? '' : String(s[h]).replace(/\"/g, '""');
    return `"${v}"`;
  }).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="students_export.csv"');
  res.send(csv);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
