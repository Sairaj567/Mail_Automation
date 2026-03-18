const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const mongoose = require('mongoose');

const n8nRoutes = require('../server/routers/n8nRoutes');
const companyRoutes = require('../server/routers/companyRoutes');
const Job = require('../server/models/Job');
const Application = require('../server/models/Application');

const original = {
  jobFindOne: Job.findOne,
  applicationFind: Application.find,
};

function restoreStubs() {
  Job.findOne = original.jobFindOne;
  Application.find = original.applicationFind;
}

test.afterEach(() => {
  restoreStubs();
});

function createRenderInterceptor() {
  return (req, res, next) => {
    res.render = (view, data) => res.json({ view, data });
    next();
  };
}

test('GET /api/n8n responds with active endpoint message', async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/n8n', n8nRoutes);

  const response = await request(app).get('/api/n8n');

  assert.equal(response.status, 200);
  assert.equal(response.body.success, true);
  assert.match(response.body.message, /base endpoint is active/i);
});

test('POST /api/n8n/company-profile returns 400 when companyName is missing', async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/n8n', n8nRoutes);

  const response = await request(app)
    .post('/api/n8n/company-profile')
    .send({ email: 'hr@acme.com' });

  assert.equal(response.status, 400);
  assert.equal(response.body.success, false);
  assert.match(response.body.message, /companyName/i);
});

test('GET /company/jobs/:id renders the job details view with applicant data', async () => {
  const companyUserId = new mongoose.Types.ObjectId().toString();
  const jobId = new mongoose.Types.ObjectId().toString();

  Job.findOne = () => ({
    populate: async () => ({
      _id: jobId,
      title: 'Backend Engineer',
      company: 'Acme Inc',
      location: 'Remote',
      jobType: 'full-time',
      salary: '$120k',
      isActive: true,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
    }),
  });

  Application.find = () => ({
    populate() {
      return this;
    },
    sort: async () => ([
      {
        _id: new mongoose.Types.ObjectId().toString(),
        status: 'applied',
        appliedDate: new Date('2026-03-10T00:00:00.000Z'),
        student: { name: 'Saira', email: 'saira@example.com' },
      },
    ]),
  });

  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.session = { user: { id: companyUserId, role: 'company', name: 'Acme HR' } };
    next();
  });
  app.use(createRenderInterceptor());
  app.use('/company', companyRoutes);

  const response = await request(app).get(`/company/jobs/${jobId}`);

  assert.equal(response.status, 200);
  assert.equal(response.body.view, 'pages/company/job-details');
  assert.equal(response.body.data.job.title, 'Backend Engineer');
  assert.equal(response.body.data.applications.length, 1);
});

test('GET /company/jobs redirects non-company users to login', async () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.session = { user: { id: 'demo-user', role: 'student', name: 'Demo Student' } };
    next();
  });
  app.use('/company', companyRoutes);

  const response = await request(app).get('/company/jobs');

  assert.equal(response.status, 302);
  assert.equal(response.headers.location, '/auth/login?role=company');
});
