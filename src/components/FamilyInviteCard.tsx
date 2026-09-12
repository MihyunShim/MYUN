import { useState } from 'react';
import { useAuth } from '../state/AuthContext';
import { BigButton, Card } from './ui';

export function FamilyInviteCard() {
  const { profile, refresh } = useAuth();
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const code = profile?.invite_code;
  return <Card style={{ background: 'var(--primary-light)' }}>
    <h2 style={{ fontSize: '1.1em', textAlign: 'center' }}>가족 초대코드</h2>
    <p aria-label={`가족 초대코드 ${code ?? '확인 중'}`} style={{ fontSize: 30, fontWeight: 800, letterSpacing: 4, textAlign: 'center', userSelect: 'text', margin: '8px 0' }}>{code ?? '확인 중'}</p>
    <p>보호자 휴대폰의 첫 화면에서 ‘가족 초대코드가 있어요’를 누르세요. 이메일 가입 없이 이름과 코드를 입력해 요청하면, 아래에서 승인할 수 있어요.</p>
    <p style={{ margin: '8px 0' }}>연결한 보호자는 관리·검진 기록과 도움 요청을 볼 수 있어요. 공유할 가족에게만 코드를 알려주세요.</p>
    <BigButton variant="ghost" disabled={!code || busy} onClick={async () => {
      if (!code) return;
      setNotice(''); setBusy(true);
      try { await navigator.clipboard.writeText(code); setNotice('초대코드를 복사했어요. 보호자에게 직접 전달해주세요.'); }
      catch { setNotice('자동 복사가 안 돼요. 위의 6자리 코드를 길게 눌러 복사하거나 직접 알려주세요.'); }
      finally { setBusy(false); }
    }}>초대코드 복사</BigButton>
    <BigButton variant="ghost" disabled={!code || busy} onClick={async () => {
      if (!code) return;
      setBusy(true); setNotice('');
      const text = `틀니케어 가족 초대코드: ${code}\n앱 첫 화면에서 ‘가족 초대코드가 있어요’를 누르고 이메일 가입 없이 연결을 요청해주세요. 제가 승인하면 관리 현황을 볼 수 있어요.`;
      try {
        if (navigator.share) await navigator.share({ title: '틀니케어 가족 초대', text });
        else { await navigator.clipboard.writeText(text); setNotice('초대 내용을 복사했어요. 카카오톡에 붙여넣어 보내주세요.'); }
      } catch (err) { if (!(err instanceof Error && err.name === 'AbortError')) setNotice('공유창을 열지 못했어요. 초대코드 복사로 직접 전달해주세요.'); }
      finally { setBusy(false); }
    }}>가족 초대 보내기</BigButton>
    <p>공유창에 카카오톡이 있으면 선택해주세요. 없으면 코드를 복사해 직접 보내주세요. 보호자 휴대폰에도 앱이 설치되어 있어야 해요.</p>
    <BigButton variant="ghost" disabled={busy} onClick={async () => {
      setBusy(true); setNotice('');
      try { await refresh(); } catch { setNotice('코드를 확인하지 못했어요. 잠시 후 다시 눌러주세요.'); } finally { setBusy(false); }
    }}>최신 코드 확인</BigButton>
    {notice && <p role="status" style={{ marginTop: 8 }}>{notice}</p>}
    <p style={{ marginTop: 8 }}>연결 여부는 아래 ‘계정과 가족 연결’에서 확인·해제할 수 있어요. 연결을 해제하면 초대코드가 바뀝니다.</p>
  </Card>;
}
