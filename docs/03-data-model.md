# Data Model (Prisma-ready)

Below are proposed entities to extend the current schema. Keep `Mail` as is for compatibility with existing n8n workflows.

## Entities

- Company
- Opportunity
- EligibilityRule
- Student
- Resume
- Application
- ExtraQuestion / ApplicationAnswer
- Attachment
- AuditLog

## Relationships (high-level)

- Company 1—N Opportunity
- Opportunity 1—N EligibilityRule
- Student 1—N Resume
- Student N—N Opportunity via Application
- Opportunity 1—N ExtraQuestion, Application 1—N Answer
- Mail 1—N Attachment (for raw email files)

## Prisma Models (draft)

```prisma
model Company {
  id         Int       @id @default(autoincrement())
  name       String
  domain     String?
  contact    String?
  email      String?
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
  opportunities Opportunity[]
}

model Opportunity {
  id           Int       @id @default(autoincrement())
  title        String
  type         String    // immediate_joining | campus_drive | internship | hackathon | pool_campus | other
  companyId    Int
  company      Company   @relation(fields: [companyId], references: [id])
  location     String?
  mode         String?   // onsite | remote | hybrid
  description  String?
  minTenth     Float?
  minTwelfth   Float?
  minCgpa      Float?
  branches     String[]
  gradYear     Int?
  applicationStart DateTime?
  applicationEnd   DateTime?
  sourceMailId Int?
  sourceMail   Mail?     @relation(fields: [sourceMailId], references: [id])
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  eligibilityRules EligibilityRule[]
  questions    ExtraQuestion[]
  applications Application[]
}

model EligibilityRule {
  id            Int      @id @default(autoincrement())
  opportunityId Int
  key           String   // e.g. backlogs_allowed, gap_years, specific_skill
  operator      String   // eq, gte, lte, in, contains
  value         String
  opportunity   Opportunity @relation(fields: [opportunityId], references: [id])
}

model Student {
  id          Int       @id @default(autoincrement())
  name        String
  email       String    @unique
  phone       String?
  branch      String?
  gradYear    Int?
  tenth       Float?
  twelfth     Float?
  cgpa        Float?
  skills      String[]
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  resumes     Resume[]
  applications Application[]
}

model Resume {
  id         Int      @id @default(autoincrement())
  studentId  Int
  url        String
  parsedJson Json?
  score      Float?
  createdAt  DateTime @default(now())
  student    Student  @relation(fields: [studentId], references: [id])
}

model Application {
  id            Int       @id @default(autoincrement())
  studentId     Int
  opportunityId Int
  status        String    @default("applied") // applied | eligible | shared | shortlisted | rejected | offered | joined
  eligibilityOk Boolean   @default(false)
  answers       ApplicationAnswer[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  student       Student     @relation(fields: [studentId], references: [id])
  opportunity   Opportunity @relation(fields: [opportunityId], references: [id])
}

model ExtraQuestion {
  id            Int      @id @default(autoincrement())
  opportunityId Int
  label         String
  type          String   // text | number | select | file | date
  required      Boolean  @default(false)
  options       String[]
  opportunity   Opportunity @relation(fields: [opportunityId], references: [id])
}

model ApplicationAnswer {
  id            Int      @id @default(autoincrement())
  applicationId Int
  questionId    Int
  value         String
  application   Application  @relation(fields: [applicationId], references: [id])
  question      ExtraQuestion @relation(fields: [questionId], references: [id])
}

model Attachment {
  id       Int      @id @default(autoincrement())
  mailId   Int
  filename String
  url      String
  mail     Mail     @relation(fields: [mailId], references: [id])
}

model AuditLog {
  id        Int      @id @default(autoincrement())
  actor     String
  action    String
  entity    String
  entityId  Int?
  meta      Json?
  createdAt DateTime @default(now())
}
```
