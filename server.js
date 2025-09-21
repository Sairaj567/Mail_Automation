const express = require('express');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const app = express();
app.use(express.json());

// Get all mails
app.get('/mails', async (req, res) => {
  const mails = await prisma.mail.findMany();
  res.json(mails);
});

// Add mail
app.post('/mails', async (req, res) => {
  const mail = await prisma.mail.create({ data: req.body });
  res.json(mail);
});

app.listen(3000, () => {
  console.log('Backend running on port 3000');
});
