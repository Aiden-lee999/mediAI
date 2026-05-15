import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const RESET_TTL_MINUTES = 30;

export function normalizeLicenseNumber(value: string) {
  return (value || '').replace(/\D/g, '').trim();
}

export function isValidLicenseFormat(value: string) {
  const normalized = normalizeLicenseNumber(value);
  return /^\d{4,10}$/.test(normalized);
}

function secret() {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'dev-only-change-this-auth-secret';
}

function hashWithSalt(password: string, salt: string) {
  return crypto.pbkdf2Sync(password, salt, 120000, 64, 'sha512').toString('hex');
}

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  return `pbkdf2_sha512$120000$${salt}$${hashWithSalt(password, salt)}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const parts = (storedHash || '').split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2_sha512') return false;
  const [, iterations, salt, hash] = parts;
  if (iterations !== '120000' || !salt || !hash) return false;
  const candidate = hashWithSalt(password, salt);
  return crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(hash, 'hex'));
}

function sign(value: string) {
  return crypto.createHmac('sha256', secret()).update(value).digest('base64url');
}

export function createSessionToken(payload: Record<string, unknown>) {
  const body = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const encoded = Buffer.from(JSON.stringify(body)).toString('base64url');
  return `${encoded}.${sign(encoded)}`;
}

export function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function createPasswordResetToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function passwordResetExpiry() {
  return new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000);
}

type LicenseVerificationInput = {
  licenseNumber: string;
  name?: string;
  birthDate?: string;
};

export async function verifyDoctorLicense(input: LicenseVerificationInput) {
  const licenseNumber = normalizeLicenseNumber(input.licenseNumber);
  if (!isValidLicenseFormat(licenseNumber)) {
    return { verified: false, reason: '면허번호 형식이 올바르지 않습니다.', source: 'FORMAT' };
  }

  const externalUrl = process.env.DOCTOR_LICENSE_VERIFY_API_URL;
  if (externalUrl) {
    const res = await fetch(externalUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.DOCTOR_LICENSE_VERIFY_API_KEY
          ? { Authorization: `Bearer ${process.env.DOCTOR_LICENSE_VERIFY_API_KEY}` }
          : {}),
      },
      body: JSON.stringify({ licenseNumber, name: input.name, birthDate: input.birthDate }),
      cache: 'no-store',
    });

    if (!res.ok) {
      return { verified: false, reason: '면허 검증기관 응답 오류입니다.', source: 'EXTERNAL_API' };
    }

    const data = await res.json().catch(() => null) as any;
    return {
      verified: data?.verified === true || data?.valid === true,
      reason: data?.message || data?.reason || '',
      source: 'EXTERNAL_API',
      payload: data,
    };
  }

  const allowlisted = await prisma.verifiedDoctorLicense.findUnique({
    where: { licenseNumber },
  });

  if (allowlisted?.status === 'ACTIVE') {
    const expectedName = (allowlisted.doctorName || '').replace(/\s+/g, '');
    const inputName = (input.name || '').replace(/\s+/g, '');
    if (expectedName && inputName && expectedName !== inputName) {
      return { verified: false, reason: '면허번호와 성명이 일치하지 않습니다.', source: allowlisted.source };
    }
    return {
      verified: true,
      reason: '등록된 면허 검증 목록에서 확인되었습니다.',
      source: allowlisted.source,
      specialty: allowlisted.specialty,
    };
  }

  if (process.env.DOCTOR_LICENSE_VERIFICATION_MODE === 'format-only') {
    return { verified: true, reason: '개발 모드 형식 검증입니다. 운영에서는 외부 검증 또는 allowlist가 필요합니다.', source: 'FORMAT_ONLY_DEV' };
  }

  return {
    verified: false,
    reason: '현재 연결된 정부 면허 검증 API 또는 검증 allowlist에서 확인되지 않았습니다.',
    source: 'NOT_CONFIGURED',
  };
}

export function publicUser(user: {
  id: string;
  name: string;
  specialty?: string | null;
  doctorLicense?: string | null;
  email?: string | null;
  jobTitle?: string | null;
  hospitalName?: string | null;
  address?: string | null;
  institutionNumber?: string | null;
  hospitalDirectoryId?: string | null;
  role: string;
  status: string;
}) {
  return {
    id: user.id,
    name: user.name,
    specialty: user.specialty || '',
    license: user.doctorLicense || '',
    email: user.email || '',
    jobTitle: user.jobTitle || '',
    hospitalName: user.hospitalName || '',
    address: user.address || '',
    institutionNumber: user.institutionNumber || '',
    hospitalDirectoryId: user.hospitalDirectoryId || '',
    role: user.role,
    status: user.status,
  };
}
