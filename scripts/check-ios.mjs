import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { loadEnv } from 'vite';

const errors = [];
const env = { ...loadEnv('production', process.cwd(), 'VITE_'), ...process.env };
if (Number(process.versions.node.split('.')[0]) < 22) errors.push('Node.js 22 이상을 설치해주세요.');
if (process.platform !== 'darwin') errors.push('아이폰 설치 준비는 Xcode가 설치된 Mac에서 실행해주세요.');
else {
  try {
    const version = execFileSync('xcodebuild', ['-version'], { encoding: 'utf8', stdio: 'pipe' });
    if (Number(version.match(/Xcode (\d+)/)?.[1] ?? 0) < 26) errors.push('출시 준비 빌드는 Xcode 26 이상을 선택해주세요. 아이폰의 iOS를 지원하는 버전이 필요해요.');
  }
  catch { errors.push('Xcode를 한 번 실행해 초기 설치를 마치고 Settings > Locations에서 Command Line Tools를 선택해주세요.'); }
}
try {
  const url = new URL(env.VITE_SUPABASE_URL);
  if (url.protocol !== 'https:' || /YOUR_PROJECT|example|localhost/i.test(url.hostname)) throw new Error();
} catch { errors.push('.env의 VITE_SUPABASE_URL에 실제 프로젝트 HTTPS URL을 입력해주세요.'); }
const key = env.VITE_SUPABASE_ANON_KEY || '';
let publicKey = key.startsWith('sb_publishable_') && key.length > 25;
if (key.split('.').length === 3) {
  try { publicKey = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role === 'anon'; } catch { /* 잘못된 키 */ }
}
if (!publicKey || key.startsWith('sb_secret_')) errors.push('.env에는 Supabase 공개 anon 또는 publishable 키만 입력해주세요. 비밀 키는 사용할 수 없어요.');
const config = JSON.parse(readFileSync('capacitor.config.json', 'utf8'));
if (config.webDir !== 'dist' || config.server?.url) errors.push('Capacitor는 dist를 사용하고 server.url 없이 설치해야 해요.');
if (errors.length) {
  for (const error of errors) console.error(`• ${error}`);
  process.exitCode = 1;
} else console.log('Xcode와 앱 연결 설정을 확인했어요. 웹 빌드와 iOS 동기화를 진행합니다.');
