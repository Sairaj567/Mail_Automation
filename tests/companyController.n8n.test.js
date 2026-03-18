const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

const companyController = require('../server/controllers/companyController');
const User = require('../server/models/User');
const CompanyProfile = require('../server/models/CompanyProfile');
const Job = require('../server/models/Job');

const { createMockReq, createMockRes } = require('./helpers/httpMocks');

const original = {
  userFindOne: User.findOne,
  userCreate: User.create,
  profileFindOne: CompanyProfile.findOne,
  profileFindOneAndUpdate: CompanyProfile.findOneAndUpdate,
  profileUpdateOne: CompanyProfile.updateOne,
  jobCreate: Job.create,
  webhookSecret: process.env.N8N_WEBHOOK_SECRET,
};

function restoreModelStubs() {
  User.findOne = original.userFindOne;
  User.create = original.userCreate;
  CompanyProfile.findOne = original.profileFindOne;
  CompanyProfile.findOneAndUpdate = original.profileFindOneAndUpdate;
  CompanyProfile.updateOne = original.profileUpdateOne;
  Job.create = original.jobCreate;

  if (original.webhookSecret === undefined) {
    delete process.env.N8N_WEBHOOK_SECRET;
  } else {
    process.env.N8N_WEBHOOK_SECRET = original.webhookSecret;
  }
}

test.afterEach(() => {
  restoreModelStubs();
});

test('n8n company-profile rejects invalid webhook secret', async () => {
  process.env.N8N_WEBHOOK_SECRET = 'expected-secret';

  const req = createMockReq({
    headers: { 'x-webhook-secret': 'wrong-secret' },
    body: { companyName: 'Acme Inc', email: 'hr@acme.com' },
  });
  const res = createMockRes();

  await companyController.handleN8nCompanyUpdate(req, res);

  assert.equal(res.statusCode, 401);
  assert.equal(res.payload.success, false);
  assert.match(res.payload.message, /invalid webhook secret/i);
});

test('n8n company-profile validates required companyName', async () => {
  process.env.N8N_WEBHOOK_SECRET = 'expected-secret';

  const req = createMockReq({
    headers: { 'x-webhook-secret': 'expected-secret' },
    body: { email: 'hr@acme.com' },
  });
  const res = createMockRes();

  await companyController.handleN8nCompanyUpdate(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.success, false);
  assert.match(res.payload.message, /companyName/i);
});

test('n8n company-profile creates user and profile for valid payload', async () => {
  process.env.N8N_WEBHOOK_SECRET = 'expected-secret';

  const createdUser = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Acme HR',
    email: 'hr@acme.com',
    role: 'company',
  };
  const createdProfile = {
    _id: new mongoose.Types.ObjectId(),
    user: createdUser._id,
    companyName: 'Acme Inc',
  };

  User.findOne = async () => null;
  User.create = async () => createdUser;
  CompanyProfile.findOne = () => ({
    lean: async () => null,
  });
  CompanyProfile.findOneAndUpdate = async () => createdProfile;

  const req = createMockReq({
    headers: { 'x-webhook-secret': 'expected-secret' },
    body: {
      companyName: 'Acme Inc',
      email: 'hr@acme.com',
      name: 'Acme HR',
      industry: 'Software',
    },
  });
  const res = createMockRes();

  await companyController.handleN8nCompanyUpdate(req, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.payload.success, true);
  assert.equal(res.payload.createdUser, true);
  assert.ok(res.payload.userId);
  assert.ok(res.payload.profileId);
  assert.ok(res.payload.temporaryPassword);
});

test('n8n job ingestion reports validation error for missing mandatory fields', async () => {
  process.env.N8N_WEBHOOK_SECRET = 'expected-secret';

  const existingUser = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Acme HR',
    email: 'hr@acme.com',
    role: 'company',
    save: async function saveUserMock() {
      return this;
    },
  };

  User.findOne = async () => existingUser;
  CompanyProfile.findOne = () => ({
    lean: async () => ({
      _id: new mongoose.Types.ObjectId(),
      user: existingUser._id,
      companyName: 'Acme Inc',
    }),
  });
  CompanyProfile.findOneAndUpdate = async () => ({
    _id: new mongoose.Types.ObjectId(),
    user: existingUser._id,
    companyName: 'Acme Inc',
  });

  const req = createMockReq({
    headers: { 'x-webhook-secret': 'expected-secret' },
    body: {
      companyName: 'Acme Inc',
      email: 'hr@acme.com',
    },
  });
  const res = createMockRes();

  await companyController.handleN8nJobCreate(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.success, false);
  assert.match(res.payload.message, /missing required job fields/i);
});

test('n8n job ingestion surfaces Mongo write errors with clear message', async () => {
  process.env.N8N_WEBHOOK_SECRET = 'expected-secret';

  const existingUser = {
    _id: new mongoose.Types.ObjectId(),
    name: 'Acme HR',
    email: 'hr@acme.com',
    role: 'company',
    save: async function saveUserMock() {
      return this;
    },
  };
  const existingProfile = {
    _id: new mongoose.Types.ObjectId(),
    user: existingUser._id,
    companyName: 'Acme Inc',
  };

  User.findOne = async () => existingUser;
  CompanyProfile.findOne = () => ({
    lean: async () => existingProfile,
  });
  CompanyProfile.findOneAndUpdate = async () => existingProfile;
  Job.create = async () => {
    throw new Error('Mongo write timeout');
  };

  const req = createMockReq({
    headers: { 'x-webhook-secret': 'expected-secret' },
    body: {
      companyName: 'Acme Inc',
      email: 'hr@acme.com',
      title: 'Backend Engineer',
      location: 'Remote',
      jobType: 'full-time',
      salary: '$120k',
      description: 'API platform role',
    },
  });
  const res = createMockRes();

  await companyController.handleN8nJobCreate(req, res);

  assert.equal(res.statusCode, 500);
  assert.equal(res.payload.success, false);
  assert.match(res.payload.message, /mongo write timeout/i);
});
