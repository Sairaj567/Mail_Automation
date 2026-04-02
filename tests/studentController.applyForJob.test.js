const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const StudentProfile = require('../server/models/StudentProfile');
const Application = require('../server/models/Application');

const { createMockReq, createMockRes } = require('./helpers/httpMocks');

function loadStudentControllerFresh() {
  const controllerPath = require.resolve('../server/controllers/studentController');
  delete require.cache[controllerPath];
  return require('../server/controllers/studentController');
}

const original = {
  profileFindOne: StudentProfile.findOne,
  applicationFindOne: Application.findOne,
  applicationSave: Application.prototype.save,
  webhookUrl: process.env.N8N_JOB_APPLICATION_WEBHOOK_URL,
  webhookSecret: process.env.N8N_WEBHOOK_SECRET,
  appBaseUrl: process.env.APP_BASE_URL,
  fetch: global.fetch,
};

function restoreStubs() {
  StudentProfile.findOne = original.profileFindOne;
  Application.findOne = original.applicationFindOne;
  Application.prototype.save = original.applicationSave;
  global.fetch = original.fetch;

  if (original.webhookUrl === undefined) {
    delete process.env.N8N_JOB_APPLICATION_WEBHOOK_URL;
  } else {
    process.env.N8N_JOB_APPLICATION_WEBHOOK_URL = original.webhookUrl;
  }

  if (original.webhookSecret === undefined) {
    delete process.env.N8N_WEBHOOK_SECRET;
  } else {
    process.env.N8N_WEBHOOK_SECRET = original.webhookSecret;
  }

  if (original.appBaseUrl === undefined) {
    delete process.env.APP_BASE_URL;
  } else {
    process.env.APP_BASE_URL = original.appBaseUrl;
  }
}

test.afterEach(() => {
  restoreStubs();
});

test('applyForJob succeeds when webhook URL is not configured (sync pending)', async () => {
  delete process.env.N8N_JOB_APPLICATION_WEBHOOK_URL;

  const studentController = loadStudentControllerFresh();

  const studentId = new mongoose.Types.ObjectId().toString();
  const jobId = new mongoose.Types.ObjectId().toString();

  StudentProfile.findOne = async () => ({ resume: 'existing-resume.pdf' });
  Application.findOne = async () => null;
  Application.prototype.save = async function saveMock() {
    this._id = new mongoose.Types.ObjectId();
    return this;
  };

  const req = createMockReq({
    session: { user: { id: studentId, name: 'Saira', email: 'saira@test.dev' } },
    body: {
      jobId,
      fullName: 'Saira',
      email: 'saira@test.dev',
    },
  });
  const res = createMockRes();

  await studentController.applyForJob(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.success, true);
  assert.equal(res.payload.sheetSync, false);
  assert.match(res.payload.message, /sheet sync is pending/i);
});

test('applyForJob handles webhook malfunction gracefully and still stores application', async () => {
  process.env.N8N_JOB_APPLICATION_WEBHOOK_URL = 'http://localhost:5678/webhook/job-application';
  process.env.N8N_WEBHOOK_SECRET = 'n8n-secret';

  const studentController = loadStudentControllerFresh();

  const studentId = new mongoose.Types.ObjectId().toString();
  const jobId = new mongoose.Types.ObjectId().toString();

  StudentProfile.findOne = async () => ({ resume: 'existing-resume.pdf' });
  Application.findOne = async () => null;
  Application.prototype.save = async function saveMock() {
    this._id = new mongoose.Types.ObjectId();
    return this;
  };

  global.fetch = async () => ({
    ok: false,
    status: 502,
    text: async () => 'Bad gateway from n8n',
  });

  const req = createMockReq({
    session: { user: { id: studentId, name: 'Saira', email: 'saira@test.dev' } },
    body: {
      jobId,
      fullName: 'Saira',
      email: 'saira@test.dev',
      linkedin: 'https://linkedin.com/in/saira',
    },
  });
  const res = createMockRes();

  await studentController.applyForJob(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.success, true);
  assert.equal(res.payload.sheetSync, false);
  assert.match(res.payload.message, /sheet sync is pending/i);
});

test('applyForJob sends a public resume URL to the sheet webhook when APP_BASE_URL is not set', async () => {
  delete process.env.APP_BASE_URL;
  process.env.N8N_JOB_APPLICATION_WEBHOOK_URL = 'http://localhost:5678/webhook/job-application';

  const studentController = loadStudentControllerFresh();

  const studentId = new mongoose.Types.ObjectId().toString();
  const jobId = new mongoose.Types.ObjectId().toString();
  const webhookCalls = [];

  StudentProfile.findOne = async () => ({ resume: 'existing-resume.pdf' });
  Application.findOne = async () => null;
  Application.prototype.save = async function saveMock() {
    this._id = new mongoose.Types.ObjectId();
    return this;
  };

  global.fetch = async (url) => {
    webhookCalls.push(url);
    return {
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => ({}),
    };
  };

  const req = createMockReq({
    session: { user: { id: studentId, name: 'Saira', email: 'saira@test.dev' } },
    body: {
      jobId,
      fullName: 'Saira',
      email: 'saira@test.dev',
    },
  });
  const res = createMockRes();

  await studentController.applyForJob(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.success, true);
  assert.equal(webhookCalls.length, 1);

  const webhookUrl = new URL(webhookCalls[0]);
  assert.equal(
    webhookUrl.searchParams.get('resume_url'),
    'http://140.245.23.142:3345/uploads/resumes/existing-resume.pdf'
  );
  assert.ok(!/localhost/i.test(webhookUrl.searchParams.get('resume_url') || ''));
});

test('applyForJob returns 500 with diagnostic message when Mongo retrieval fails', async () => {
  delete process.env.N8N_JOB_APPLICATION_WEBHOOK_URL;

  const studentController = loadStudentControllerFresh();

  const studentId = new mongoose.Types.ObjectId().toString();
  const jobId = new mongoose.Types.ObjectId().toString();

  StudentProfile.findOne = async () => {
    throw new Error('Mongo read failure on student_profiles');
  };

  const req = createMockReq({
    session: { user: { id: studentId, name: 'Saira', email: 'saira@test.dev' } },
    body: {
      jobId,
      fullName: 'Saira',
      email: 'saira@test.dev',
    },
  });
  const res = createMockRes();

  await studentController.applyForJob(req, res);

  assert.equal(res.statusCode, 500);
  assert.equal(res.payload.success, false);
  assert.match(res.payload.message, /mongo read failure/i);
});

test('applyForJob autofills applicant identity from session when form omits it', async () => {
  delete process.env.N8N_JOB_APPLICATION_WEBHOOK_URL;

  const studentController = loadStudentControllerFresh();

  const studentId = new mongoose.Types.ObjectId().toString();
  const jobId = new mongoose.Types.ObjectId().toString();

  StudentProfile.findOne = async () => ({
    resume: 'existing-resume.pdf',
    phone: '9876543210',
    college: 'Test College',
    course: 'B.Tech',
    graduationYear: 2027,
    cgpa: 8.1,
    skills: ['Node.js', 'MongoDB'],
    socialLinks: { linkedin: 'https://linkedin.com/in/saira' },
  });
  Application.findOne = async () => null;
  Application.prototype.save = async function saveMock() {
    this._id = new mongoose.Types.ObjectId();
    return this;
  };

  const req = createMockReq({
    session: { user: { id: studentId, name: 'Saira Session', email: 'session@test.dev' } },
    body: { jobId },
  });
  const res = createMockRes();

  await studentController.applyForJob(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.success, true);
  assert.equal(res.payload.sheetSync, false);
});

test('applyForJob returns clear validation error when applicant identity is unavailable', async () => {
  delete process.env.N8N_JOB_APPLICATION_WEBHOOK_URL;

  const studentController = loadStudentControllerFresh();

  const studentId = new mongoose.Types.ObjectId().toString();
  const jobId = new mongoose.Types.ObjectId().toString();

  StudentProfile.findOne = async () => ({ resume: 'existing-resume.pdf' });
  Application.findOne = async () => null;

  const req = createMockReq({
    session: { user: { id: studentId } },
    body: { jobId },
  });
  const res = createMockRes();

  await studentController.applyForJob(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.success, false);
  assert.match(res.payload.message, /full name, email/i);
});
