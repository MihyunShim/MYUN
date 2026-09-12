import { useCallback, useEffect, useRef, useState } from 'react';
import { db, friendlyError } from '../lib/db';
import { useAuth } from '../state/AuthContext';
import { useRefreshOnResume } from '../lib/useRefreshOnResume';
import { BigButton, Card, ErrorBox } from './ui';
interface Request { id: string; other_name: string; relation: string; status: string; expires_at: string }
export function GuardianRequests({ elder = false }: { elder?: boolean }) {
  const { refresh } = useAuth();
  const [rows, setRows] = useState<Request[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const load = useCallback(async () => {
    try {
      const r = await db().rpc('list_guardian_requests');
      if (r.error) throw r.error;
      setRows(r.data ?? []); setError('');
    } catch (err) { setError(friendlyError(err)); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useRefreshOnResume(load);
  const act = async (id: string, accept?: boolean) => {
    if (working.current) return;
    working.current = true; setBusy(true); setError('');
    try {
      const r = elder ? await db().rpc('resolve_guardian_request', { request_id: id, accept }) : await db().rpc('cancel_guardian_request', { request_id: id });
      if (r.error) throw r.error;
      await load(); await refresh();
    } catch (err) { setError(friendlyError(err)); }
    finally { working.current = false; setBusy(false); }
  };
  return <Card>
    <h2 style={{ fontSize: '1.1em' }}>{elder ? '보호자 연결 요청' : '내 연결 요청'}</h2>
    {elder && <p>직접 초대한 가족인지 확인한 뒤 승인해주세요. 승인하면 관리 현황·검진일·도움 요청이 공유돼요.</p>}
    <ErrorBox message={error} />
    {!error && rows.length === 0 && <p>연결 요청이 없어요.</p>}
    {rows.map(r => <div key={r.id} style={{ margin: '16px 0' }}>
      <p>{r.other_name} · 등록 관계: {r.relation}</p>
      <p role="status">{r.status === 'pending' ? '사용자 승인 대기 중 · 요청은 24시간 동안 유효해요.' : r.status === 'approved' ? '승인됐어요. 아래에서 현황을 확인해주세요.' : '요청이 거절·취소되었거나 만료됐어요. 최신 코드로 다시 요청해주세요.'}</p>
      {r.status === 'pending' && (elder ? <>
        <BigButton disabled={busy} onClick={() => void act(r.id, true)}>아는 가족이에요 · 연결 승인</BigButton>
        <BigButton variant="ghost" disabled={busy} onClick={() => void act(r.id, false)}>모르는 요청이에요 · 거절</BigButton>
      </> : <BigButton variant="ghost" disabled={busy} onClick={() => void act(r.id)}>연결 요청 취소</BigButton>)}
    </div>)}
    <BigButton variant="ghost" disabled={busy} onClick={async () => { await load(); await refresh(); }}>{elder ? '연결 요청 새로고침' : '승인 여부 확인 · 가족 현황 보기'}</BigButton>
  </Card>;
}
