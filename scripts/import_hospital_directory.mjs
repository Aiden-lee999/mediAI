import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const defaultDir = 'C:/Users/이재용/Downloads/전국 병의원 및 약국 현황 2026.3/전국 병의원 및 약국 현황 2026.3';
const basicPath = process.argv[2] || path.join(defaultDir, '1.병원정보서비스(2026.3.).csv');
const detailPath = process.argv[3] || path.join(defaultDir, '4.의료기관별상세정보서비스_02_세부정보(2026.3.).csv');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch !== '\r') {
      cell += ch;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const headers = rows.shift()?.map((h) => h.replace(/^\uFEFF/, '').trim()) || [];
  return rows.filter((r) => r.some((v) => String(v || '').trim())).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
}

function readCsv(file) {
  if (!fs.existsSync(file)) throw new Error(`CSV 파일을 찾을 수 없습니다: ${file}`);
  return parseCsv(fs.readFileSync(file, 'utf8'));
}

function text(row, key) {
  const value = row?.[key];
  return value === undefined || value === null || String(value).trim() === '' ? null : String(value).trim();
}

function int(row, key) {
  const value = text(row, key);
  if (!value) return null;
  const parsed = Number(String(value).replace(/[^0-9-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function float(row, key) {
  const value = text(row, key);
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dataFromRows(basic, detail) {
  return {
    encryptedCode: text(basic, '암호화요양기호') || text(detail, '암호화요양기호'),
    name: text(basic, '요양기관명') || text(detail, '요양기관명') || '이름 없음',
    typeCode: text(basic, '종별코드'),
    typeName: text(basic, '종별코드명'),
    sidoCode: text(basic, '시도코드'),
    sidoName: text(basic, '시도코드명'),
    sigunguCode: text(basic, '시군구코드'),
    sigunguName: text(basic, '시군구코드명'),
    eupmyeondong: text(basic, '읍면동'),
    zipCode: text(basic, '우편번호'),
    address: text(basic, '주소'),
    phone: text(basic, '전화번호'),
    homepage: text(basic, '병원홈페이지'),
    openDate: text(basic, '개설일자'),
    totalDoctors: int(basic, '총의사수'),
    generalDoctors: int(basic, '의과일반의 인원수'),
    specialists: int(basic, '의과전문의 인원수'),
    dentistDoctors: (int(basic, '치과일반의 인원수') || 0) + (int(basic, '치과전문의 인원수') || 0) || null,
    koreanDoctors: (int(basic, '한방일반의 인원수') || 0) + (int(basic, '한방전문의 인원수') || 0) || null,
    midwives: int(basic, '조산사 인원수'),
    longitude: float(basic, '좌표(X)'),
    latitude: float(basic, '좌표(Y)'),
    landmark: text(detail, '위치_공공건물(장소)명'),
    direction: text(detail, '위치_방향'),
    distance: text(detail, '위치_거리'),
    parkingCapacity: int(detail, '주차_가능대수'),
    parkingPaid: text(detail, '주차_비용 부담여부'),
    parkingNote: text(detail, '주차_기타 안내사항'),
    closedSunday: text(detail, '휴진안내_일요일'),
    closedHoliday: text(detail, '휴진안내_공휴일'),
    erDayAvailable: text(detail, '응급실_주간_운영여부'),
    erDayPhone1: text(detail, '응급실_주간_전화번호1'),
    erDayPhone2: text(detail, '응급실_주간_전화번호2'),
    erNightAvailable: text(detail, '응급실_야간_운영여부'),
    erNightPhone1: text(detail, '응급실_야간_전화번호1'),
    erNightPhone2: text(detail, '응급실_야간_전화번호2'),
    lunchWeekday: text(detail, '점심시간_평일'),
    lunchSaturday: text(detail, '점심시간_토요일'),
    receptionWeekday: text(detail, '접수시간_평일'),
    receptionSaturday: text(detail, '접수시간_토요일'),
    sundayStart: int(detail, '진료시작시간_일요일'),
    sundayEnd: int(detail, '진료종료시간_일요일'),
    mondayStart: int(detail, '진료시작시간_월요일'),
    mondayEnd: int(detail, '진료종료시간_월요일'),
    tuesdayStart: int(detail, '진료시작시간_화요일'),
    tuesdayEnd: int(detail, '진료종료시간_화요일'),
    wednesdayStart: int(detail, '진료시작시간_수요일'),
    wednesdayEnd: int(detail, '진료종료시간_수요일'),
    thursdayStart: int(detail, '진료시작시간_목요일'),
    thursdayEnd: int(detail, '진료종료시간_목요일'),
    fridayStart: int(detail, '진료시작시간_금요일'),
    fridayEnd: int(detail, '진료종료시간_금요일'),
    saturdayStart: int(detail, '진료시작시간_토요일'),
    saturdayEnd: int(detail, '진료종료시간_토요일'),
    rawBasic: basic || undefined,
    rawDetail: detail || undefined,
  };
}

async function main() {
  console.log(`basic: ${basicPath}`);
  console.log(`detail: ${detailPath}`);
  const basicRows = readCsv(basicPath);
  const detailRows = readCsv(detailPath);
  const basicByCode = new Map(basicRows.map((row) => [text(row, '암호화요양기호'), row]).filter(([code]) => code));
  const detailByCode = new Map(detailRows.map((row) => [text(row, '암호화요양기호'), row]).filter(([code]) => code));
  const codes = [...new Set([...basicByCode.keys(), ...detailByCode.keys()])];
  console.log(`merge target: ${codes.length.toLocaleString()} rows`);

  let done = 0;
  const concurrency = 20;
  for (let i = 0; i < codes.length; i += concurrency) {
    const chunk = codes.slice(i, i + concurrency);
    await Promise.all(chunk.map((code) => {
      const data = dataFromRows(basicByCode.get(code) || {}, detailByCode.get(code) || {});
      if (!data.encryptedCode) return null;
      return prisma.hospitalDirectory.upsert({
        where: { encryptedCode: data.encryptedCode },
        update: data,
        create: data,
      });
    }));
    done += chunk.length;
    if (done % 1000 < concurrency) console.log(`imported ${done.toLocaleString()} / ${codes.length.toLocaleString()}`);
  }
  console.log(`done: ${done.toLocaleString()}`);
}

main().finally(async () => prisma.$disconnect());
