import { FamilyConsent } from './PrivacyConsent';
import { useCallback, useEffect, useRef, useState } from 'react';
import { db, friendlyError } from '../lib/db';
import { useAuth } from '../state/AuthContext';
import { useRefreshOnResume } from '../lib/useRefreshOnResume';
import { BigButton, Card, ErrorBox } from './ui';
interface Request { id: string; other_name: string; relation: string; status: string; expires_at: string }
const descriptions: Record<string, string> = {
  pending: '사용자 승인 대기 중 · 요청은 24시간 동안 유효해요.',
  approved: '승인됐어요. 아래에서 가족 현황을 확인해주세요.',
  rejected: '사용자가 요청을 거절했어요. 가족에게 먼저 확인한 뒤 다시 요청해주세요.',
  cancelled: '연결 요청이 취소됐거나 연결이 해제됐어요. 다시 연결하려면 최신 초대코드가 필요해요.',
  expired: '24시간이 지나 요청이 만료됐어요. 최신 초대코드로 다시 요청해주세요.',
};
export function GuardianRequests({ elder = false, reloadKey = 0, onPendingChange }: {
  elder?: boolean; reloadKey?: number; onPendingChange?: (pending: boolean) => void;
}) {
  const { refresh } = useAuth();
  const [approving,setApproving]=useState<string|null>(null);
  const [rows, setRows] = useState<Request[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  const [now, setNow] = useState(Date.now());
  const working = useRef(false);
  const generation = useRef(0);
  const load = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    try {
      const r = await db().rpc('list_guardian_requests');
      if (r.error) throw r.error;
      if (current !== generation.current) return;
      setRows(r.data ?? []); setError(''); setNow(Date.now());
    } catch (err) { if (current === generation.current) setError(friendlyError(err)); }
    finally { if (current === generation.current) setLoading(false); }
  }, []);
  useEffect(() => { void load(); return () => { generation.current++; }; }, [load, reloadKey]);
  useRefreshOnResume(load);
  const statusOf = (r: Request) => r.status === 'pending' && Date.parse(r.expires_at) <= now ? 'expired' : r.status;
  const pending = rows.some(r => statusOf(r) === 'pending');
  useEffect(() => { if (!loading && !error) onPendingChange?.(pending); }, [pending, loading, error, onPendingChange]);
  useEffect(() => {
    const expiry = Math.min(...rows.filter(r => r.status === 'pending').map(r => Date.parse(r.expires_at)).filter(time => time > now));
    if (!Number.isFinite(expiry)) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.min(expiry - now + 50, 2147483647));
    return () => window.clearTimeout(timer);
  }, [rows, now]);
  const act = async (id: string, accept?: boolean) => {
    if (working.current || loading) return;
    working.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const r = elder ? await db().rpc('resolve_guardian_request', { request_id: id, accept }) : await db().rpc('cancel_guardian_request', { request_id: id });
      if (r.error) throw r.error;
      await load();
      setNotice(elder ? accept ? '가족 연결을 승인했어요.' : '연결 요청을 거절했어요.' : '연결 요청을 취소했어요.');
      await refresh();
    } catch (err) { setError(friendlyError(err)); }
    finally { working.current = false; setBusy(false); }
  };
  return <Card>
    <h2 style={{ fontSize: '1.1em' }}>{elder ? '보호자 연결 요청' : '내 연결 요청'}</h2>
    {elder && <p>직접 초대한 가족인지 확인한 뒤 승인해주세요. 승인하면 관리 현황·검진일·도움 요청이 공유돼요.</p>}
    <ErrorBox message={error} />
    {loading && <p role="status">연결 요청을 확인하고 있어요...</p>}
    {notice && <p role="status">{notice}</p>}
    {!loading && !error && rows.length === 0 && <p>연결 요청이 없어요.</p>}
    {!loading && !error && rows.map(r => <div key={r.id} style={{ margin: '16px 0' }}>
      <p>{r.other_name} · 등록 관계: {r.relation}</p>
      <p role="status">{descriptions[statusOf(r)] ?? '요청 상태를 다시 확인해주세요.'}</p>
      {statusOf(r) === 'pending' && <>
        {Number.isFinite(Date.parse(r.expires_at)) && <p>유효 기한: {new Date(r.expires_at).toLocaleString('ko-KR')}</p>}
        {elder ? <>
          <BigButton disabled={busy} onClick={() => setApproving(r.id)}>아는 가족이에요 · 연결 승인</BigButton>
          {approving===r.id && <FamilyConsent recipient={r.other_name} requestId={r.id} onCancel={()=>setApproving(null)} onComplete={async()=>{setApproving(null);await load();setNotice('가족 연결을 승인했어요.');await refresh();}}/>}
          <BigButton variant="ghost" disabled={busy} onClick={() => void act(r.id, false)}>모르는 요청이에요 · 거절</BigButton>
        </> : <BigButton variant="ghost" disabled={busy} onClick={() => void act(r.id)}>연결 요청 취소</BigButton>}
      </>}
    </div>)}
    <BigButton variant="ghost" disabled={busy || loading} onClick={async () => { await load(); await refresh(); }}>{elder ? '연결 요청 새로고침' : '승인 여부 확인 · 가족 현황 보기'}</BigButton>
  </Card>;
}
