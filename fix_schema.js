const fs = require('fs');

let text = fs.readFileSync('e:/mediAI/prisma/schema.prisma', 'utf8');

const idx = text.indexOf('model PatientIntake');
const safePart = text.substring(0, idx);

const customText = `model PatientIntake {
  id        String   @id @default(uuid())
  patientLang String
  symptom     String
  duration    String
  history     String
  occupation  String?
  summaryChat String?
  createdAt DateTime @default(now())
}

model ChartRecord {
  id        String   @id @default(uuid())
  content   String
  createdAt DateTime @default(now())
}

model PatientSummary {
  id        String   @id @default(uuid())
  lang      String
  content   String
  createdAt DateTime @default(now())
}

model ConsentForm {
  id        String   @id @default(uuid())
  lang      String
  signature String
  content   String?
  createdAt DateTime @default(now())
}`;

fs.writeFileSync('e:/mediAI/prisma/schema.prisma', safePart + '\n' + customText, 'utf8');