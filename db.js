const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const FILE = path.join(__dirname, 'students.json');
let students = [];

if (fs.existsSync(FILE)) {
  try { students = JSON.parse(fs.readFileSync(FILE, 'utf8') || '[]'); } catch(e) { students = []; }
}

function save() { fs.writeFileSync(FILE, JSON.stringify(students, null, 2)); }

module.exports = {
  getStudents: () => students.slice().reverse(),
  findStudent: (id) => students.find(s => s.id === id),
  findByRoll: (roll) => students.find(s => String(s.rollNumber).toLowerCase() === String(roll).toLowerCase()),
  findByEmail: (email) => students.find(s => String(s.email).toLowerCase() === String(email).toLowerCase()),
  addStudent: (payload) => {
    const now = new Date().toISOString();
    const student = {
      id: uuidv4(),
      rollNumber: payload.rollNumber || '',
      name: payload.name || '',
      email: payload.email || '',
      phone: payload.phone || '',
      age: payload.age || '',
      course: payload.course || '',
      address: payload.address || '',
      admissionDate: payload.admissionDate || now,
      gender: payload.gender || 'Other',
      status: payload.status || 'Active',
      avatarUrl: payload.avatarUrl || '',
      createdAt: now,
      updatedAt: now
    };
    students.push(student);
    save();
    return student;
  },
  updateStudent: (id, patch) => {
    const idx = students.findIndex(s => s.id === id);
    if (idx === -1) return null;
    const now = new Date().toISOString();
    const s = students[idx];
    students[idx] = { ...s, ...Object.fromEntries(Object.entries(patch).filter(([k,v]) => v !== undefined)), updatedAt: now };
    save();
    return students[idx];
  },
  deleteStudent: (id) => {
    const idx = students.findIndex(s => s.id === id);
    if (idx === -1) return false;
    students.splice(idx, 1);
    save();
    return true;
  }
};
