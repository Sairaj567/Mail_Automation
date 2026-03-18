const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const Job = require('../server/models/Job');

const original = {
  findById: Job.findById,
  updateOne: Job.updateOne,
  fetch: global.fetch,
  sheetWebhookUrl: process.env.N8N_MAIL_SHEET_MAKER_WEBHOOK_URL,
  appWebhookUrl: process.env.N8N_JOB_APPLICATION_WEBHOOK_URL,
  webhookSecret: process.env.N8N_WEBHOOK_SECRET,
};

function loadAdminControllerFresh() {
  const controllerPath = require.resolve('../server/controllers/adminController');
  delete require.cache[controllerPath];
  return require('../server/controllers/adminController');
}

function createMockRes() {
  return {
    statusCode: 200,
    payload: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.payload = data;
      return this;
    },
    redirectUrl: undefined,
    redirect(url) {
      this.redirectUrl = url;
      return this;
    },
  };
}

function restoreStubs() {
  Job.findById = original.findById;
  Job.updateOne = original.updateOne;
  global.fetch = original.fetch;

  if (original.sheetWebhookUrl === undefined) {
    delete process.env.N8N_MAIL_SHEET_MAKER_WEBHOOK_URL;
  } else {
    process.env.N8N_MAIL_SHEET_MAKER_WEBHOOK_URL = original.sheetWebhookUrl;
  }

  if (original.appWebhookUrl === undefined) {
    delete process.env.N8N_JOB_APPLICATION_WEBHOOK_URL;
  } else {
    process.env.N8N_JOB_APPLICATION_WEBHOOK_URL = original.appWebhookUrl;
  }

  if (original.webhookSecret === undefined) {
    delete process.env.N8N_WEBHOOK_SECRET;
  } else {
    process.env.N8N_WEBHOOK_SECRET = original.webhookSecret;
  }
}

test.afterEach(() => {
  restoreStubs();
});

test('activateJob triggers sheet-maker webhook when configured', async () => {
  process.env.N8N_MAIL_SHEET_MAKER_WEBHOOK_URL = 'http://localhost:5678/webhook/job-application';
  process.env.N8N_WEBHOOK_SECRET = 'abc123';

  const adminController = loadAdminControllerFresh();

  const jobId = new mongoose.Types.ObjectId();
  const job = {
    _id: jobId,
    title: 'Backend Engineer',
    company: 'Acme Inc',
    location: 'Remote',
    jobType: 'full-time',
    salary: '$120k',
    description: 'APIs',
    skills: ['node'],
    experienceLevel: '0-2',
  };

  Job.findById = () => ({ lean: async () => job });
  Job.updateOne = async () => ({ acknowledged: true, modifiedCount: 1 });

  let capturedUrl = '';
  let capturedOptions = {};
  global.fetch = async (url, options) => {
    capturedUrl = url;
    capturedOptions = options;
    return {
      ok: true,
      status: 200,
      text: async () => 'ok',
    };
  };

  const req = {
    params: { id: jobId.toString() },
    xhr: true,
    headers: { accept: 'application/json' },
    session: { user: { id: 'admin', role: 'admin' } },
  };
  const res = createMockRes();

  await adminController.activateJob(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.success, true);
  assert.equal(res.payload.sync.sent, true);
  assert.match(capturedUrl, /job_id=/i);
  assert.match(capturedUrl, /sync_source=admin_activation/i);
  assert.equal(capturedOptions.method, 'POST');
  assert.equal(capturedOptions.headers['x-webhook-secret'], 'abc123');
});

test('activateJob succeeds when webhook URL is not configured', async () => {
  delete process.env.N8N_MAIL_SHEET_MAKER_WEBHOOK_URL;
  delete process.env.N8N_JOB_APPLICATION_WEBHOOK_URL;

  const adminController = loadAdminControllerFresh();

  const jobId = new mongoose.Types.ObjectId();
  const job = {
    _id: jobId,
    title: 'Data Analyst',
    company: 'Acme Inc',
    location: 'Remote',
    jobType: 'full-time',
    salary: '$90k',
    description: 'SQL',
    skills: ['sql'],
    experienceLevel: 'fresher',
  };

  Job.findById = () => ({ lean: async () => job });
  Job.updateOne = async () => ({ acknowledged: true, modifiedCount: 1 });

  let fetchCalled = false;
  global.fetch = async () => {
    fetchCalled = true;
    return { ok: true, status: 200, text: async () => 'ok' };
  };

  const req = {
    params: { id: jobId.toString() },
    xhr: true,
    headers: { accept: 'application/json' },
    session: { user: { id: 'admin', role: 'admin' } },
  };
  const res = createMockRes();

  await adminController.activateJob(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.success, true);
  assert.equal(res.payload.sync.sent, false);
  assert.equal(res.payload.sync.reason, 'missing_webhook_url');
  assert.equal(fetchCalled, false);
});
