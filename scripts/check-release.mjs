import { loadEnv } from 'vite';
import { readFileSync } from 'node:fs';
import { publicHttps, validatePrivacyArtifacts } from './privacy-validation.mjs';

// Only validates configuration; never prints keys or contacts, contacts servers or publishes.
const env = { ...loadEnv('production', process.cwd(), 'VITE_'), ...process.env };
const issues = [];
if (!publicHttps(env.VITE_PRIVACY_POLICY_URL)) issues.push('실제 개인정보처리방침 HTTPS 주소 (VITE_PRIVACY_POLICY_URL)');
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.VITE_SUPPORT_EMAIL || '') || /example\.|\.invalid$/i.test(env.VITE_SUPPORT_EMAIL)) issues.push('실제 운영자 문의 이메일 (VITE_SUPPORT_EMAIL)');
if (!publicHttps(env.VITE_SUPABASE_URL)) issues.push('실제 Supabase HTTPS 주소 (VITE_SUPABASE_URL)');
const key = env.VITE_SUPABASE_ANON_KEY || '';
let publicKey = key.startsWith('sb_publishable_') && key.length > 25;
try { if (key.split('.').length === 3) publicKey = JSON.parse(Buffer.from(key.split('.')[1], 'base64url')).role === 'anon'; } catch { /* invalid */ }
if (!publicKey || key.startsWith('sb_secret_') || /test_fixture|YOUR_/i.test(key)) issues.push('Supabase 공개 anon/publishable 키 (비밀 키 사용 금지)');
issues.push(...validatePrivacyArtifacts('privacy/generated', env.VITE_PRIVACY_POLICY_URL));
const config = JSON.parse(readFileSync('capacitor.config.json', 'utf8'));
if (config.webDir !== 'dist' || config.server?.url) issues.push('배포용 Capacitor 설정: dist 사용, server.url 제거');
if (issues.length) {
  console.error('출시 설정에서 확인할 항목:');
  issues.forEach(item => console.error(`• ${item}`));
  process.exitCode = 1;
} else console.log('출시 설정 형식을 확인했어요. URL 공개 접근, 문의 수신, 실제 서버·기기 동작과 심사는 별도 확인이 필요해요.');
