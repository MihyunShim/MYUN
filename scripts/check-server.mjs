import { loadEnv } from 'vite';
import { checkServer } from './server-readiness.mjs';

const args = process.argv.slice(2);
const mode = args.length === 0 ? 'development' : args.length === 2 && args[0] === '--mode' && /^[a-zA-Z0-9_-]+$/.test(args[1]) && args[1] !== 'local' ? args[1] : null;
if (!mode) {
  console.error('사용법: npm run server:check -- [--mode development|staging|production]');
  process.exitCode = 1;
} else {
  const result = await checkServer(loadEnv(mode, process.cwd(), 'VITE_'));
  console.log(`서버 공개 설정 점검 (${mode}) — 읽기 전용`);
  for (const check of result.checks) console.log(`[${check.status}] ${check.detail}`);
  console.log('이 결과는 DB 마이그레이션 전체·접근 권한·실제 가입·메일 수신·가족 연결 완료를 증명하지 않습니다.');
  process.exitCode = result.publicChecksPassed ? 0 : 1;
}
