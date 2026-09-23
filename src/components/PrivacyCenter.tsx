import { useRef, useState } from 'react';
import { db, friendlyError } from '../lib/db';
import { cancelRoutineNotifications, setNotificationOwner } from '../lib/notifications';
import { useAuth } from '../state/AuthContext';
import { type PrivacyDocument, usePrivacyNotice } from '../lib/privacy';
import { NoticeContent } from './PrivacyConsent';
import { BigButton, Card, ErrorBox } from './ui';
const kinds:Record<string,string>={access:'개인정보 열람',correction:'개인정보 정정',deletion:'개인정보 삭제',suspension:'개인정보 처리정지'};
const statuses:Record<string,string>={received:'접수',processing:'처리 중',completed:'처리 완료',refused:'처리 제한 · 사유 확인'};
const actions:Record<string,string>={accepted:'개인정보 동의',health_withdrawn:'건강정보 동의 철회',family_shared:'가족 공유 동의',family_withdrawn:'가족 공유 철회',guardian_request:'보호자 정보 제공 동의'};
interface Event {id:string;version:string;action:string;recorded_at:string;choices:{sensitive?:boolean;recipient_name?:string;personal?:boolean;overseas?:boolean}}
interface Request {id:string;kind:string;status:string;response:string|null;created_at:string}
export function PrivacyCenter() {
  const { profile,refresh }=useAuth(); const { notice }=usePrivacyNotice();
  const [events,setEvents]=useState<Event[]>([]); const [requests,setRequests]=useState<Request[]>([]);
  const [opened,setOpened]=useState(false); const [loaded,setLoaded]=useState(false); const [busy,setBusy]=useState(false);
  const [error,setError]=useState(''); const [message,setMessage]=useState(''); const [withdraw,setWithdraw]=useState(false);
  const [oldNotice,setOldNotice]=useState<{version:string;document:PrivacyDocument}|null>(null);
  const inFlight=useRef(false);
  const load=async()=>{
    const results=await Promise.all([db().rpc('list_privacy_events'),db().rpc('list_privacy_requests')]);
    for(const r of results) if(r.error) throw r.error;
    setEvents(results[0].data??[]);setRequests(results[1].data??[]);setLoaded(true);
  };
  const run=async(work:()=>Promise<void>)=>{
    if(inFlight.current)return;inFlight.current=true;setBusy(true);setError('');setMessage('');
    try{await work();}catch(e){setError(friendlyError(e));}finally{inFlight.current=false;setBusy(false);}
  };
  return <Card><h2>개인정보 관리</h2>
    <p>동의를 확인하거나 철회하고 열람·정정·삭제·처리정지를 요청할 수 있어요. 전체 동의 철회와 계정 삭제는 아래 ‘회원 탈퇴’에서 진행해요.</p>
    {notice && <p>담당자 연락처: {notice.document.contact}</p>}
    <ErrorBox message={error}/>{message&&<p role="status">{message}</p>}
    <BigButton variant="ghost" disabled={busy} onClick={()=>void run(async()=>{setOpened(true);await load();})}>동의 내역·권리 요청 확인</BigButton>
    {opened&&loaded&&<>
      <h3>내 동의 내역</h3>{events.length===0&&<p>기록된 동의가 없어요. 이전 동의를 임의로 추가하지 않아요.</p>}
      {events.map(e=><div key={e.id} style={{margin:'16px 0'}}><p>{actions[e.action]??e.action} · {new Date(e.recorded_at).toLocaleString('ko-KR')}</p><p>문서 버전: {e.version}</p>
        {e.action==='accepted'&&<p>일반 개인정보·국외 이전: 동의 / 건강정보: {e.choices.sensitive?'동의':'미동의'}</p>}
        {e.choices.recipient_name&&<p>제공받는 가족: {e.choices.recipient_name}</p>}
        <BigButton variant="ghost" disabled={busy} onClick={()=>void run(async()=>{const r=await db().rpc('get_accepted_notice',{notice_version:e.version});if(r.error)throw r.error;if(r.data)setOldNotice({version:e.version,document:r.data});})}>이때의 안내문 보기</BigButton>
      </div>)}
      {oldNotice&&<details open><summary>동의 당시 안내문</summary><NoticeContent notice={oldNotice}/></details>}
      <h3>권리 행사 요청</h3><p>요청은 운영자에게 접수돼요. 자동 처리 완료나 이메일 발송을 뜻하지 않아요. 진행 상황과 답변을 여기서 확인해주세요. 필요한 정정 내용 등은 위 담당자 연락처로 전달해주세요.</p>
      {Object.entries(kinds).map(([kind,label])=><BigButton key={kind} variant="ghost" disabled={busy} onClick={()=>void run(async()=>{const r=await db().rpc('submit_privacy_request',{request_kind:kind});if(r.error)throw r.error;await load();setMessage(`${label} 요청을 접수했어요.`);})}>{label} 요청</BigButton>)}
      {requests.map(r=><p key={r.id}>{kinds[r.kind]} · {statuses[r.status]} · {new Date(r.created_at).toLocaleDateString('ko-KR')}{r.response&&<span style={{display:'block'}}>운영자 답변: {r.response}</span>}</p>)}
    </>}
    {profile?.role==='A1'&&<>
      <BigButton variant="ghost" disabled={busy} onClick={()=>setWithdraw(true)}>건강정보 삭제·동의 철회</BigButton>
      {withdraw&&<><p>틀니 정보, 관리 시간·기록, 검진 기록·예약일, 도움 요청을 서버에서 삭제하고 가족 공유를 중단해요. 되돌릴 수 없어요. 계정은 남으며 다시 동의하기 전까지 건강정보 기능을 사용할 수 없어요. 백업·운영 로그의 삭제 기간은 개인정보 안내를 확인해주세요.</p>
        <BigButton variant="danger" disabled={busy} onClick={()=>void run(async()=>{
          const r=await db().rpc('withdraw_health_consent');if(r.error)throw r.error;
          setNotificationOwner(null);
          try{await cancelRoutineNotifications();}finally{await refresh();}
          setWithdraw(false);setMessage('건강정보를 삭제하고 동의를 철회했어요.');if(opened)await load();
        })}>건강정보 삭제하고 철회하기</BigButton><BigButton variant="ghost" disabled={busy} onClick={()=>setWithdraw(false)}>철회 취소</BigButton></>}
    </>}
    {(profile?.birth_year||profile?.phone)&&<BigButton variant="ghost" disabled={busy} onClick={()=>void run(async()=>{const r=await db().rpc('clear_legacy_profile_fields');if(r.error)throw r.error;await refresh();setMessage('이전 버전에 저장한 생년·전화번호를 지웠어요.');})}>이전 생년·전화번호 지우기</BigButton>}
  </Card>;
}
