import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isIP } from 'node:net';
import { resolve } from 'node:path';

export function publicHttps(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    return url.protocol === 'https:' && !url.username && !url.password &&
      host.includes('.') && !isIP(host) && !host.startsWith('[') &&
      !/(^|\.)(localhost|local|internal|invalid|test|example)(\.|$)|your_project/i.test(host) &&
      !/(^|\.)example\.(com|org|net)$/.test(host);
  } catch { return false; }
}

export function validatePrivacyNotice(notice, today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())) {
  const errors = [];
  const document = notice?.document;
  const required = (value, path) => {
    if (typeof value !== 'string' || !value.trim() || /미정|확인 필요|TODO|테스트 전용|시험 전용|example\.(com|invalid|org|net)|YOUR_/i.test(value)) errors.push(path);
  };
  required(notice?.version, 'version');
  for (const key of ['operator', 'officer', 'contact', 'effectiveDate', 'policyUrl', 'destruction', 'safeguards', 'processors', 'localStorage', 'rights']) required(document?.[key], key);
  for (const key of ['account', 'guardian', 'health', 'overseas', 'family', 'familyHealth', 'guardianShare']) {
    for (const field of ['purpose', 'items', 'retention', 'refusal']) required(document?.[key]?.[field], `${key}.${field}`);
  }
  if (!Array.isArray(document?.transfers) || !document.transfers.length) errors.push('transfers');
  else document.transfers.forEach((transfer, index) => {
    for (const key of ['recipient', 'contact', 'countries', 'items', 'purpose', 'timingMethod', 'retention', 'refusal']) required(transfer?.[key], `transfers[${index}].${key}`);
  });
  if (document?.reviewed !== true) errors.push('reviewed: 운영자 검토 확인 필요');
  if (!publicHttps(document?.policyUrl)) errors.push('policyUrl: 실제 공개 HTTPS URL 필요');
  const date = document?.effectiveDate;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '') || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date || date > today) errors.push('effectiveDate: 실제 달력의 적용 가능한 시행일 필요');
  return errors;
}

export const sha256 = (content) => createHash('sha256').update(content).digest('hex');

// Integrity/consistency check only; not a legal or deployment approval.
export function validatePrivacyArtifacts(directory, policyUrl) {
  try {
    const read = (file) => readFileSync(resolve(directory, file), 'utf8');
    const noticeText = read('notice.json');
    const notice = JSON.parse(noticeText);
    const manifest = JSON.parse(read('manifest.json'));
    const errors = validatePrivacyNotice(notice);
    if (notice.document?.policyUrl !== policyUrl) errors.push('앱과 게시용 개인정보처리방침 주소 불일치');
    for (const file of ['notice.json', 'privacy.html', 'publish-notice.sql']) {
      if (manifest.files?.[file] !== sha256(read(file))) errors.push(`${file}: 생성 이후 내용 변경 또는 검증 정보 누락`);
    }
    if (manifest.version !== notice.version) errors.push('게시 문서 버전 불일치');
    return errors;
  } catch {
    return ['검토된 개인정보 게시 파일이 없거나 손상됐어요. privacy:prepare 명령으로 다시 생성해주세요.'];
  }
}
