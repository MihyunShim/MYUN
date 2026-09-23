// Generates review files only. Never connects to or mutates Supabase.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const input=process.argv[2];
if(!input){console.error('사용법: npm run privacy:prepare -- privacy/notice.reviewed.json');process.exit(1);}
const notice=JSON.parse(readFileSync(input,'utf8')); const d=notice.document;
const errors=[];
function required(value,path){if(typeof value!=='string'||!value.trim()||/미정|확인 필요|TODO|테스트 전용|시험 전용|example\.(com|invalid)|YOUR_/i.test(value))errors.push(path);}
required(notice.version,'version');
for(const key of ['operator','officer','contact','effectiveDate','policyUrl','destruction','safeguards','processors','localStorage','rights'])required(d?.[key],key);
for(const key of ['account','guardian','health','overseas','family','familyHealth','guardianShare'])for(const field of ['purpose','items','retention','refusal'])required(d?.[key]?.[field],`${key}.${field}`);
if(!Array.isArray(d?.transfers)||!d.transfers.length)errors.push('transfers');
else d.transfers.forEach((t,i)=>{for(const key of ['recipient','contact','countries','items','purpose','timingMethod','retention','refusal'])required(t[key],`transfers[${i}].${key}`);});
if(d?.reviewed!==true)errors.push('reviewed: 운영자 검토 확인 필요');
if(!/^https:\/\/[^\s]+$/.test(d?.policyUrl??''))errors.push('policyUrl: 실제 공개 HTTPS URL 필요');
if(!/^\d{4}-\d{2}-\d{2}$/.test(d?.effectiveDate??'')||Number.isNaN(Date.parse(d.effectiveDate))||d.effectiveDate>new Date().toISOString().slice(0,10))errors.push('effectiveDate: 적용 가능한 시행일 필요');
if(errors.length){console.error('개인정보 안내 확정이 필요합니다:\n'+errors.map(x=>' - '+x).join('\n'));process.exit(1);}
const quote=v=>"'"+v.replaceAll("'","''")+"'";
const sql=`-- Review before running in Supabase. Apply 008 first. A new version requires renewed consent.\nbegin;\nupdate public.privacy_notices set active=false where active;\ninsert into public.privacy_notices(version,document,active) values(${quote(notice.version)},${quote(JSON.stringify(d))}::jsonb,true);\ncommit;\n`;
const esc=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const labels={operator:'운영자',officer:'개인정보 보호책임자',contact:'연락처',effectiveDate:'시행일',policyUrl:'공개 주소',account:'틀니 사용자 개인정보 수집·이용',guardian:'보호자 개인정보 수집·이용',health:'건강정보(민감정보) 처리',overseas:'국외 이전',family:'가족에게 개인정보 제공',familyHealth:'가족에게 건강정보 제공',guardianShare:'초대코드 사용자에게 보호자 정보 제공',transfers:'국외 이전 상세',recipient:'받는 자',countries:'국가',timingMethod:'시기·방법',purpose:'목적',items:'항목',retention:'보유·이용기간',refusal:'거부 방법·영향',destruction:'파기',safeguards:'안전성 확보조치',processors:'처리위탁',localStorage:'기기 저장 정보',rights:'정보주체 권리행사'};
const htmlOf=v=>Array.isArray(v)?v.map(x=>'<section>'+htmlOf(x)+'</section>').join(''):typeof v==='object'?Object.entries(v).filter(([k])=>k!=='reviewed').map(([k,x])=>`<div><h3>${esc(labels[k]??k)}</h3>${typeof x==='string'?`<p>${esc(x)}</p>`:htmlOf(x)}</div>`).join(''):esc(v);
const dir=resolve('privacy/generated');mkdirSync(dir,{recursive:true});writeFileSync(dir+'/publish-notice.sql',sql);writeFileSync(dir+'/privacy.html',`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>틀니케어 개인정보처리방침</title><style>body{max-width:48rem;margin:2rem auto;padding:0 1rem;font:18px/1.7 system-ui;overflow-wrap:anywhere}h3{font-size:1.1em}section{border:1px solid #ddd;padding:1rem}</style><main><h1>틀니케어 개인정보처리방침</h1><p>버전: ${esc(notice.version)}</p>${htmlOf(d)}<p>만 14세 이상 대상 · 광고·마케팅 동의 없음</p><p>침해 상담: 개인정보침해 신고센터 118 / 개인정보 분쟁조정위원회 1833-6972</p></main></html>`);
console.log('검토 파일 생성: privacy/generated/privacy.html, privacy/generated/publish-notice.sql (서버에는 적용하지 않았습니다)');
