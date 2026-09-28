import { ConsentDetails, NoticeContent, TransferDetails } from './PrivacyNoticeContent';
export { ConsentDetails, NoticeContent } from './PrivacyNoticeContent';
import { useEffect, useState } from 'react';
import { db, friendlyError } from '../lib/db';
import { type ConsentChoices, type PrivacyNotice, canAccept, emptyChoices, usePrivacyNotice } from '../lib/privacy';
import { BigButton, Card, ErrorBox } from './ui';

export function CheckConsent({ children, label, checked, onChange, disabled = false }: {
  children?: React.ReactNode; label: string; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean;
}) {
  return <div style={{ margin: '16px 0', minWidth: 0 }}>
    {children}
    <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 0', cursor: 'pointer', fontWeight: 700 }}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} style={{ width: 24, height: 24, flexShrink: 0, marginTop: 3 }} />
      <span>{label}</span>
    </label>
  </div>;
}
export function PrivacyNoticeView() {
  const { notice,error,loading,reload } = usePrivacyNotice();
  return <Card><details><summary>개인정보 처리 안내</summary>
    {loading ? <p role="status">안내를 불러오는 중...</p> : notice ? <NoticeContent notice={notice} /> : <p>운영자가 개인정보 안내를 준비하고 있어요. 안내가 공개되기 전에는 새 가입이나 동의를 진행할 수 없어요.</p>}
    <ErrorBox message={error} />{!notice && <BigButton variant="ghost" onClick={reload}>개인정보 안내 다시 확인</BigButton>}
  </details></Card>;
}
export function ConsentFields({ role, notice, choices, onChange, disabled = false }: {
  role: 'A1'|'A2'; notice: PrivacyNotice; choices: ConsentChoices; onChange: (choices: ConsentChoices) => void; disabled?: boolean;
}) {
  const change = (k: keyof ConsentChoices, value: boolean) => onChange({ ...choices,[k]:value });
  return <fieldset disabled={disabled} className="privacy-fieldset"><legend>개인정보 안내와 동의</legend>
    <p>운영자: {notice.document.operator} · 문의: {notice.document.contact}</p>
    <details><summary>개인정보처리방침 전체 읽기</summary><NoticeContent notice={notice} /></details>
    <CheckConsent label="만 14세 이상이에요" checked={choices.age14} onChange={v=>change('age14',v)}><p>현재 만 14세 미만 가입은 지원하지 않아요.</p></CheckConsent>
    <CheckConsent label="[필수] 개인정보 수집·이용에 동의해요" checked={choices.personal} onChange={v=>change('personal',v)}><ConsentDetails detail={role==='A1' ? notice.document.account : notice.document.guardian} /></CheckConsent>
    {role==='A1' && <CheckConsent label="[선택] 건강정보(민감정보) 처리에 동의해요" checked={choices.sensitive} onChange={v=>change('sensitive',v)}><ConsentDetails detail={notice.document.health} /><p>동의하지 않아도 계정과 앱 안내는 이용할 수 있어요. 틀니·관리·검진 기록은 동의 후 사용할 수 있어요.</p></CheckConsent>}
    <CheckConsent label="[필수] 개인정보 국외 이전에 동의해요" checked={choices.overseas} onChange={v=>change('overseas',v)}><ConsentDetails detail={notice.document.overseas} /><TransferDetails notice={notice} /></CheckConsent>
    <p>가족에게 공유하는 동의는 연결할 때 따로 받아요. 미리 선택된 동의 항목은 없어요.</p>
  </fieldset>;
}
export function SignupConsent({ role, disabled, onChange }: { role:'A1'|'A2'; disabled:boolean; onChange:(choices: (ConsentChoices & {version:string}) | null)=>void }) {
  const { notice,error,loading,reload } = usePrivacyNotice();
  const [choices,setChoices] = useState(emptyChoices);
  useEffect(() => { setChoices(emptyChoices()); }, [notice?.version]);
  useEffect(() => { onChange(canAccept(notice,choices) && notice ? {...choices,version:notice.version} : null); },[notice,choices,onChange]);
  return <><ErrorBox message={error} />{loading ? <p role="status">개인정보 안내를 불러오는 중...</p> : notice ? <ConsentFields role={role} notice={notice} choices={choices} onChange={setChoices} disabled={disabled} /> : <><p>개인정보 안내를 준비 중이에요. 준비가 끝나면 가입할 수 있어요.</p><BigButton variant="ghost" disabled={disabled} onClick={reload}>개인정보 안내 다시 확인</BigButton></>}</>;
}
export function FamilyConsent({ recipient, requestId, linkId, onComplete, onCancel }: { recipient:string; requestId?:string; linkId?:string; onComplete:()=>Promise<void>; onCancel:()=>void }) {
  const { notice,error:loadError,loading }=usePrivacyNotice();
  const [personal,setPersonal]=useState(false); const [sensitive,setSensitive]=useState(false);
  const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  return <Card><h3>{recipient}님에게 공유할 정보</h3><p>직접 초대한 분인지 확인해주세요. 공유를 거절해도 본인 관리 기능은 계속 이용할 수 있어요.</p>
    <ErrorBox message={loadError || error} />{loading && <p>안내를 불러오는 중...</p>}
    {notice && <>
      <CheckConsent label="[선택] 이 가족에게 개인정보 제공에 동의해요" checked={personal} disabled={busy} onChange={setPersonal}><ConsentDetails detail={notice.document.family} /></CheckConsent>
      <CheckConsent label="[선택] 이 가족에게 건강정보 제공에 동의해요" checked={sensitive} disabled={busy} onChange={setSensitive}><ConsentDetails detail={notice.document.familyHealth} /></CheckConsent>
    </>}
    <p>설정에서 가족 연결을 해제하면 앞으로의 조회가 중단돼요. 상대가 이미 별도로 저장한 화면까지 지울 수는 없어요.</p>
    <BigButton disabled={busy || !notice || !personal || !sensitive} onClick={async()=>{
      if (!notice || busy) return; setBusy(true); setError('');
      try {
        const args={notice_version:notice.version,personal_share:personal,sensitive_share:sensitive};
        const r=await db().rpc(linkId ? 'renew_family_consent':'approve_guardian_with_consent',linkId ? {...args,link_id:linkId} : {...args,request_id:requestId});
        if(r.error) throw r.error; await onComplete();
      } catch(e){setError(friendlyError(e));} finally{setBusy(false);}
    }}>{busy?'저장 중...':'동의하고 가족에게 공유'}</BigButton>
    <BigButton variant="ghost" disabled={busy} onClick={onCancel}>취소</BigButton>
  </Card>;
}
