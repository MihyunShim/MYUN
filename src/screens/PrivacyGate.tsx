import { useEffect, useState } from 'react';
import { useAuth } from '../state/AuthContext';
import { db, friendlyError } from '../lib/db';
import { canAccept, emptyChoices, usePrivacyNotice } from '../lib/privacy';
import { ConsentFields } from '../components/PrivacyConsent';
import { AccountActions, AppInformation } from '../components/AccountActions';
import { Screen, Title, BigButton, ErrorBox } from '../components/ui';
export default function PrivacyGate() {
  const { profile,refresh,signOut }=useAuth(); const {notice,error:loadError,loading,reload}=usePrivacyNotice();
  const [choices,setChoices]=useState(emptyChoices);const [busy,setBusy]=useState(false);const [error,setError]=useState('');const [message,setMessage]=useState('');
  useEffect(()=>{setChoices(emptyChoices());},[notice?.version]);
  return <Screen><Title>개인정보 안내를 확인해주세요</Title><p>기존 동의를 임의로 추가하지 않아요. 건강정보 처리를 원하지 않으면 앱 안내와 개인정보 관리만 이용할 수 있어요.</p>
    <ErrorBox message={loadError||error}/>{message&&<p role="status">{message}</p>}
    {loading?<p>안내를 불러오는 중...</p>:notice&&profile?<ConsentFields role={profile.role} notice={notice} choices={choices} onChange={setChoices} disabled={busy}/>:<><p>운영자가 개인정보 안내를 준비하고 있어요.</p><BigButton variant="ghost" onClick={reload}>안내 다시 확인</BigButton></>}
    <BigButton disabled={busy||!canAccept(notice,choices)} onClick={async()=>{
      if(!notice||busy)return;setBusy(true);setError('');
      try{const r=await db().rpc('accept_privacy_consent',{choices:{...choices,version:notice.version}});if(r.error)throw r.error;await refresh();setMessage('동의를 저장했어요. 건강정보 미동의 상태에서는 앱 안내와 개인정보 관리를 이용할 수 있어요.');}
      catch(e){setError(friendlyError(e));}finally{setBusy(false);}
    }}>{busy?'저장 중...':'선택한 동의 저장'}</BigButton>
    <AppInformation/><AccountActions/><BigButton variant="ghost" disabled={busy} onClick={signOut}>로그아웃</BigButton>
  </Screen>;
}
