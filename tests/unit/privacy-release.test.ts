import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, expect, it } from 'vitest';
import { publicHttps, validatePrivacyNotice, validatePrivacyArtifacts } from '../../scripts/privacy-validation.mjs';
const temporary: string[] = [];
const makeDirectory = () => { const dir = mkdtempSync(join(tmpdir(), 'denture-privacy-')); temporary.push(dir); return dir; };
const generator = resolve('scripts/prepare-privacy.mjs');
// Synthetic data used only in ephemeral test directories; never published.
const valid = () => JSON.parse(readFileSync('tests/fixtures/privacy-notice.json', 'utf8').replaceAll('테스트 전용', '검증용').replaceAll('시험 전용', '검증용').replaceAll('example.invalid', 'denturecare.qa'));
afterEach(() => { for (const dir of temporary.splice(0)) rmSync(dir, { recursive: true, force: true }); });
it('빈 운영 정보와 모의 안내 파일은 게시 파일을 생성하지 못한다', () => {
  for (const input of ['privacy/notice.draft.json', 'tests/fixtures/privacy-notice.json']) {
    const cwd = makeDirectory(); const result = spawnSync(process.execPath, [generator, resolve(input)], { cwd, encoding: 'utf8' });
    expect(result.status).toBe(1); expect(existsSync(join(cwd, 'privacy/generated/privacy.html'))).toBe(false);
  }
});
it('실제 달력에 없는 날짜와 아직 오지 않은 시행일을 거절한다', () => {
  const notice = valid();
  for (const date of ['2026-02-30', '2026-13-01', '2026-09-28']) {
    notice.document.effectiveDate = date;
    expect(validatePrivacyNotice(notice, '2026-09-27').join()).toContain('effectiveDate');
  }
  notice.document.effectiveDate = '2024-02-29';
  expect(validatePrivacyNotice(notice, '2026-09-27')).toEqual([]);
});
it('비공개·예시·자격증명 포함 주소를 공개 정책 URL로 허용하지 않는다', () => {
  for (const url of ['http://denturecare.qa', 'https://localhost', 'https://127.0.0.1', 'https://[::1]', 'https://privacy.local', 'https://example.com/privacy', 'https://user:secret@denturecare.qa/privacy']) expect(publicHttps(url)).toBe(false);
  expect(publicHttps('https://denturecare.qa/privacy')).toBe(true);
});
it('생성된 안내·SQL·HTML의 일치와 앱 URL을 확인하고 변경된 파일을 거절한다', () => {
  const cwd = makeDirectory(); const notice = valid(); notice.document.operator = "검증용 O'Name <script>alert(1)</script>";
  writeFileSync(join(cwd, 'notice.json'), JSON.stringify(notice));
  const result = spawnSync(process.execPath, [generator, 'notice.json'], { cwd, encoding: 'utf8' });
  expect(result.status, result.stderr).toBe(0);
  const dir = join(cwd, 'privacy/generated');
  expect(validatePrivacyArtifacts(dir, notice.document.policyUrl)).toEqual([]);
  expect(readFileSync(join(dir, 'privacy.html'), 'utf8')).not.toContain('<script>');
  expect(readFileSync(join(dir, 'publish-notice.sql'), 'utf8')).toContain("O''Name");
  expect(validatePrivacyArtifacts(dir, 'https://different.denturecare.qa')).toContain('앱과 게시용 개인정보처리방침 주소 불일치');
  writeFileSync(join(dir, 'privacy.html'), 'stale page');
  expect(validatePrivacyArtifacts(dir, notice.document.policyUrl).join()).toContain('privacy.html');
});
it('손상된 JSON과 누락 파일은 스택·비밀 값 없이 설명한다', () => {
  const cwd = makeDirectory(); writeFileSync(join(cwd, 'bad.json'), 'secret-invalid-json');
  const result = spawnSync(process.execPath, [generator, 'bad.json'], { cwd, encoding: 'utf8' });
  expect(result.status).toBe(1); expect(result.stderr).toContain('경로와 JSON 형식');
  expect(result.stderr).not.toContain('secret-invalid-json');
  expect(validatePrivacyArtifacts(cwd, 'https://denturecare.qa').length).toBe(1);
});
