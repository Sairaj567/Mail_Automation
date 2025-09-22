const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const app = express();
// Trust Traefik proxy to get correct protocol/IP for logging and cookies
app.set('trust proxy', 1);
app.use(express.json());

// Basic healthcheck
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Get mails with optional filters: status, category, limit
app.get('/mails', async (req, res) => {
  try {
    const { status, category, limit } = req.query;
    const where = {};
    if (status) where.status = String(status);
    if (category) where.category = String(category);
    const take = limit ? Math.min(parseInt(limit, 10) || 50, 200) : undefined;
    const mails = await prisma.mail.findMany({ where, orderBy: { receivedAt: 'desc' }, take });
    res.json(mails);
  } catch (err) {
    console.error('GET /mails error', err);
    res.status(500).json({ error: 'Failed to fetch mails' });
  }
});

// Optional webhook secret verification for n8n → set N8N_WEBHOOK_SECRET to enable
function verifyWebhookSecret(req) {
  const required = process.env.N8N_WEBHOOK_SECRET;
  if (!required) return true; // not enforced
  const got = req.headers['x-webhook-secret'] || req.headers['x-n8n-secret'];
  return typeof got === 'string' && got === required;
}

// Add mail (webhook target for n8n)
app.post('/mails', async (req, res) => {
  try {
    if (!verifyWebhookSecret(req)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { from, to, subject, body, category, receivedAt, status } = req.body || {};
    if (!from || !to || !subject || !body) {
      return res.status(400).json({ error: 'Missing required fields: from, to, subject, body' });
    }
    // Only allow known fields
    const data = {
      from: String(from),
      to: String(to),
      subject: String(subject),
      body: String(body),
      category: category ? String(category) : 'uncategorized',
      receivedAt: receivedAt ? new Date(receivedAt) : undefined,
      status: status ? String(status) : undefined,
    };
    const mail = await prisma.mail.create({ data });
    res.status(201).json(mail);
  } catch (err) {
    console.error('POST /mails error', err);
    res.status(500).json({ error: 'Failed to create mail' });
  }
});

// Update mail status/category
app.patch('/mails/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: 'Invalid id' });
    const { status, category } = req.body || {};
    if (!status && !category) return res.status(400).json({ error: 'Nothing to update' });
    const updated = await prisma.mail.update({
      where: { id },
      data: {
        status: status ? String(status) : undefined,
        category: category ? String(category) : undefined,
      },
    });
    res.json(updated);
  } catch (err) {
    console.error('PATCH /mails/:id error', err);
    res.status(500).json({ error: 'Failed to update mail' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});

// -----------------------------
// Additional APIs (MVP)
// -----------------------------

// Opportunities
app.get('/opportunities', async (req, res) => {
  try {
    const items = await prisma.opportunity.findMany({
      include: { company: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(items);
  } catch (err) {
    console.error('GET /opportunities error', err);
    res.status(500).json({ error: 'Failed to fetch opportunities' });
  }
});

app.post('/opportunities', async (req, res) => {
  try {
    const { title, type, companyName, description } = req.body || {};
    if (!title || !type || !companyName) {
      return res.status(400).json({ error: 'Missing fields: title, type, companyName' });
    }
    // Upsert company by name
    const company = await prisma.company.upsert({
      where: { name: String(companyName) },
      update: {},
      create: { name: String(companyName) },
    });
    const opp = await prisma.opportunity.create({
      data: {
        title: String(title),
        type: String(type),
        companyId: company.id,
        description: description ? String(description) : undefined,
      },
    });
    res.status(201).json(opp);
  } catch (err) {
    console.error('POST /opportunities error', err);
    res.status(500).json({ error: 'Failed to create opportunity' });
  }
});

app.get('/opportunities/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const opp = await prisma.opportunity.findUnique({
      where: { id },
      include: { company: true, questions: true, eligibilityRules: true },
    });
    if (!opp) return res.status(404).json({ error: 'Not found' });
    res.json(opp);
  } catch (err) {
    console.error('GET /opportunities/:id error', err);
    res.status(500).json({ error: 'Failed to fetch opportunity' });
  }
});

app.patch('/opportunities/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const data = req.body || {};
    const updated = await prisma.opportunity.update({ where: { id }, data });
    res.json(updated);
  } catch (err) {
    console.error('PATCH /opportunities/:id error', err);
    res.status(500).json({ error: 'Failed to update opportunity' });
  }
});

// Students
app.post('/students', async (req, res) => {
  try {
    const { name, email, phone, branch, gradYear, tenth, twelfth, cgpa, skills } = req.body || {};
    if (!name || !email) return res.status(400).json({ error: 'Missing fields: name, email' });
    const student = await prisma.student.create({
      data: {
        name: String(name),
        email: String(email),
        phone: phone ? String(phone) : undefined,
        branch: branch ? String(branch) : undefined,
        gradYear: gradYear ? Number(gradYear) : undefined,
        tenth: tenth ? Number(tenth) : undefined,
        twelfth: twelfth ? Number(twelfth) : undefined,
        cgpa: cgpa ? Number(cgpa) : undefined,
        skills: Array.isArray(skills) ? skills.map(String) : [],
      },
    });
    res.status(201).json(student);
  } catch (err) {
    console.error('POST /students error', err);
    res.status(500).json({ error: 'Failed to create student' });
  }
});

app.get('/students/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const student = await prisma.student.findUnique({ where: { id }, include: { resumes: true } });
    if (!student) return res.status(404).json({ error: 'Not found' });
    res.json(student);
  } catch (err) {
    console.error('GET /students/:id error', err);
    res.status(500).json({ error: 'Failed to fetch student' });
  }
});

app.patch('/students/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const data = req.body || {};
    if (data.skills && Array.isArray(data.skills)) data.skills = data.skills.map(String);
    const updated = await prisma.student.update({ where: { id }, data });
    res.json(updated);
  } catch (err) {
    console.error('PATCH /students/:id error', err);
    res.status(500).json({ error: 'Failed to update student' });
  }
});

// Apply to opportunity
app.post('/opportunities/:id/apply', async (req, res) => {
  try {
    const opportunityId = Number(req.params.id);
    const { studentId, answers } = req.body || {};
    if (!studentId) return res.status(400).json({ error: 'Missing field: studentId' });

    // Simple eligibility check (MVP): verify basic thresholds if set
    const opp = await prisma.opportunity.findUnique({ where: { id: opportunityId } });
    if (!opp) return res.status(404).json({ error: 'Opportunity not found' });
    const stu = await prisma.student.findUnique({ where: { id: Number(studentId) } });
    if (!stu) return res.status(404).json({ error: 'Student not found' });

    let eligibilityOk = true;
    if (opp.minCgpa != null && (stu.cgpa ?? 0) < opp.minCgpa) eligibilityOk = false;
    if (opp.minTenth != null && (stu.tenth ?? 0) < opp.minTenth) eligibilityOk = false;
    if (opp.minTwelfth != null && (stu.twelfth ?? 0) < opp.minTwelfth) eligibilityOk = false;
    if (opp.gradYear != null && stu.gradYear != null && stu.gradYear !== opp.gradYear) eligibilityOk = false;
    if (opp.branches && opp.branches.length > 0 && stu.branch && !opp.branches.includes(stu.branch)) eligibilityOk = false;

    const appRec = await prisma.application.create({
      data: {
        studentId: stu.id,
        opportunityId: opp.id,
        eligibilityOk,
      },
    });

    // Save answers if provided (must map to existing questions)
    if (Array.isArray(answers) && answers.length) {
      const toCreate = answers
        .filter(a => a && a.questionId && typeof a.value !== 'undefined')
        .map(a => ({ applicationId: appRec.id, questionId: Number(a.questionId), value: String(a.value) }));
      if (toCreate.length) await prisma.applicationAnswer.createMany({ data: toCreate });
    }

    res.status(201).json(appRec);
  } catch (err) {
    console.error('POST /opportunities/:id/apply error', err);
    res.status(500).json({ error: 'Failed to apply to opportunity' });
  }
});
