import { FamilyConsent, PrivacyNoticeView } from './PrivacyConsent';
import { PrivacyCenter } from './PrivacyCenter';
import { HelpGuide } from './HelpGuide';
import { useCallback, useEffect, useRef, useState } from 'react';
import { db, friendlyError } from '../lib/db';
import { useAuth } from '../state/AuthContext';
import { useRefreshOnResume } from '../lib/useRefreshOnResume';
import { Card, BigButton, Field, ErrorBox } from './ui';

export function AppInformation() {
  const policy = import.meta.env.VITE_PRIVACY_POLICY_URL as string | undefined;
  const support = import.meta.env.VITE_SUPPORT_EMAIL as string | undefined;
  return <><PrivacyNoticeView /><HelpGuide /><Card>
    <h2 style={{ fontSize: '1.1em', marginBottom: 8 }}>앱 안내</h2>
    <p style={{ marginBottom: 8 }}>설치 버전: {import.meta.env.VITE_BUILD_LABEL || '개발 환경'}</p>
    <p>틀니케어는 일상 관리와 기록을 도와드려요. 진단이나 응급 연락 서비스는 아니에요. 불편한 증상과 검진 일정은 담당 치과에 확인해주세요.</p>
    <p style={{ marginTop: 8 }}>계정·틀니 정보와 관리 기록은 서버에 저장돼요. 초대코드로 요청하고 본인이 승인한 가족은 관리 현황과 도움 요청을 볼 수 있어요. 연결은 언제든 해제할 수 있어요.</p>
    {policy?.startsWith('https://') && <p style={{ marginTop: 12 }}><a href={policy} target="_blank" rel="noopener noreferrer">개인정보처리방침</a></p>}
    {support && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(support) && <p><a href={`mailto:${support}`}>문의하기</a></p>}
  </Card></>;
}

interface Link { link_id: string; other_name: string; relation: string | null; linked_at: string; }

export function AccountActions() {
  const { refresh, signOut, profile } = useAuth();
  const [sharing, setSharing] = useState<string | null>(null);
  const [links, setLinks] = useState<Link[]>([]);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [deleted, setDeleted] = useState(false);
  const operation = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const result = await db().rpc('list_my_care_links');
      if (result.error) throw result.error;
      setLinks(result.data ?? []);
    } catch (err) { setLoadError(friendlyError(err)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useRefreshOnResume(load);

  const unlink = async (id: string) => {
    if (operation.current) return;
    operation.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await db().from('care_links').update({ status: 'revoked' }).eq('id', id).select('id').single();
      if (result.error) throw result.error;
      setUnlinking(null);
      await load();
      await refresh();
    } catch (err) { setError(friendlyError(err)); }
    finally { operation.current = false; setBusy(false); }
  };

  const deleteAccount = async () => {
    if (confirmation !== '탈퇴' || operation.current || deleted) return;
    operation.current = true;
    setBusy(true);
    setError('');
    try {
      // 서버는 전달된 사용자 ID가 아닌, 검증된 로그인 계정(auth.uid)만 삭제한다.
      const result = await db().rpc('delete_own_account');
      if (result.error) throw result.error;
      setDeleted(true);
      setConfirmation('');
      await signOut();
    } catch (err) { setError(friendlyError(err)); }
    finally { operation.current = false; setBusy(false); }
  };

  if (deleted) return <Card>
    <p role="status">계정과 기록을 삭제했어요. 이 기기의 로그인을 종료하고 있어요.</p>
    <ErrorBox message={error} />
    <BigButton disabled={busy} onClick={async () => {
      if (operation.current) return;
      operation.current = true; setBusy(true); setError('');
      try { await signOut(); } catch (err) { setError(friendlyError(err)); }
      finally { operation.current = false; setBusy(false); }
    }}>{busy ? '로그인 종료 중...' : '로그인 종료 다시 시도'}</BigButton>
  </Card>;

  return <><PrivacyCenter /><Card>
    <p style={{ fontWeight: 800, marginBottom: 8 }}>계정과 가족 연결</p>
    {loading && <p role="status">가족 연결을 확인하고 있어요...</p>}
    <BigButton variant="ghost" disabled={loading || busy} onClick={() => void load()}>연결 목록 새로고침</BigButton>
    <ErrorBox message={loadError} />
    {loadError && <BigButton variant="ghost" disabled={loading || busy} onClick={() => void load()}>가족 연결 다시 확인</BigButton>}
    {!loading && !loadError && links.length === 0 && <p>연결된 가족이 없어요.</p>}
    <ErrorBox message={error} />
    {links.map((link) => <div key={link.link_id} style={{ margin: '12px 0', paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
      <p style={{ fontWeight: 700 }}>{link.other_name || '연결된 가족'}</p>
      <p style={{ fontSize: 15 }}>등록한 관계: {link.relation || '가족'}</p>
      {profile?.role === 'A1' && (sharing === link.link_id ? <FamilyConsent recipient={link.other_name} linkId={link.link_id} onCancel={() => setSharing(null)} onComplete={async () => { setSharing(null); await refresh(); }} /> : <BigButton variant="ghost" disabled={busy} onClick={() => setSharing(link.link_id)}>이 가족의 공유 동의 확인·갱신</BigButton>)}
      {unlinking === link.link_id ? <>
        <p>연결을 해제하면 이 연결을 통한 관리 현황과 도움 요청 공유가 중단돼요. 기존 초대코드는 바뀌며, 다시 연결하려면 새 코드가 필요해요.</p>
        <BigButton variant="danger" disabled={busy} onClick={() => unlink(link.link_id)}>연결 해제하기</BigButton>
        <BigButton variant="ghost" disabled={busy} onClick={() => setUnlinking(null)}>취소</BigButton>
      </> : <BigButton variant="ghost" disabled={busy} onClick={() => setUnlinking(link.link_id)}>가족 연결 해제</BigButton>}
    </div>)}
    {deleting ? <>
      <p style={{ margin: '12px 0' }}>탈퇴하면 계정, 틀니 정보, 관리·검진 기록, 가족 연결과 본인의 도움 요청이 삭제돼요. 되돌릴 수 없어요. 가족의 계정은 유지돼요. 백업·운영 로그의 삭제 기간과 법령상 보존 예외는 개인정보 안내에서 확인해주세요.</p>
      <Field label="확인하려면 ‘탈퇴’를 입력해주세요" value={confirmation} onChange={setConfirmation} />
      <BigButton variant="danger" disabled={busy || confirmation !== '탈퇴'} onClick={deleteAccount}>{busy ? '처리 중...' : '계정과 기록 영구 삭제'}</BigButton>
      <BigButton variant="ghost" disabled={busy} onClick={() => { setDeleting(false); setConfirmation(''); }}>취소</BigButton>
    </> : <BigButton variant="ghost" disabled={busy} onClick={() => setDeleting(true)}>회원 탈퇴</BigButton>}
  </Card></>;
}
