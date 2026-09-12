import { useEffect, useState, useCallback } from 'react';
import { db, friendlyError } from '../lib/db';
import { useAuth } from '../state/AuthContext';
import { calculateRecall } from '../lib/recall';
import { Screen, Title, Card, BigButton, Splash, ErrorBox } from '../components/ui';
import { calendarDaysUntil, localDateString } from '../lib/dates';
import { isValidCheckupDate, nextCheckup, type CheckupSchedule } from '../lib/checkups';
import { useRefreshOnResume } from '../lib/useRefreshOnResume';

interface Denture {
  made_year: number;
  made_month: number;
  clinic_name: string | null;
  clinic_phone: string | null;
}
interface Checkup {
  id: string;
  visited_on: string;
  next_recall_on: string | null;
  interval_months: number | null;
}

// A1 치과 검진 화면 (docs/설계/01 A1-4): 리콜 D-day, 사용 단계, 검진 기록
export default function CheckupA1() {
  const { session } = useAuth();
  const [denture, setDenture] = useState<Denture | null>(null);
  const [checkups, setCheckups] = useState<Checkup[]>([]);
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<CheckupSchedule | null>(null);
  const [scheduleError, setScheduleError] = useState('');
  const [scheduleReady, setScheduleReady] = useState(false);
  const [dateInput, setDateInput] = useState('');
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!session) return;
    try {
    const [d, c, planned] = await Promise.all([
      db().from('dentures').select('*').eq('user_id', session.user.id).maybeSingle(),
      db().from('checkups').select('*').eq('user_id', session.user.id).order('visited_on', { ascending: false }),
      db().from('checkup_schedules').select('user_id,scheduled_on').eq('user_id', session.user.id).maybeSingle(),
    ]);
    if (d.error || c.error) throw d.error || c.error;
    setError('');
    setScheduleReady(!planned.error);
    setScheduleError(planned.error ? '치과에서 안내받은 일정을 불러오지 못했어요. 다시 불러와 주세요.' : '');
    setSchedule(planned.error ? null : planned.data as CheckupSchedule | null);
    setDenture((d.data as Denture) ?? null);
    setCheckups((c.data as Checkup[]) ?? []);
    } catch (err) { setError(friendlyError(err)); }
    finally { setLoading(false); }
  }, [session]);

  useEffect(() => { load(); }, [load]);
  useRefreshOnResume(load);

  if (loading) return <Splash text="검진 정보를 불러오는 중..." />;

  const recall = denture ? calculateRecall(denture.made_year, denture.made_month) : null;
  const latest = checkups[0] ?? null;

  // 담당 치과 안내일만 예정일로 취급하고 기존 계산값은 별도로 구분한다.
  const next = nextCheckup(schedule, latest?.next_recall_on);
  const dDay = next?.confirmed ? calendarDaysUntil(next.date) : null;

  const saveSchedule = async () => {
    if (!session || busy || !isValidCheckupDate(dateInput)) return;
    setBusy(true); setScheduleError(''); setNotice('');
    try {
      const result = await db().from('checkup_schedules').upsert({ user_id: session.user.id, scheduled_on: dateInput }, { onConflict: 'user_id' }).select('user_id,scheduled_on').single();
      if (result.error) throw result.error;
      setSchedule(result.data as CheckupSchedule); setEditingSchedule(false);
      setNotice('치과에서 안내받은 검진일을 저장했어요.');
    } catch (err) { setScheduleError(friendlyError(err)); }
    finally { setBusy(false); }
  };

  const cancelSchedule = async () => {
    if (!session || !schedule || busy) return;
    setBusy(true); setScheduleError(''); setNotice('');
    try {
      const result = await db().from('checkup_schedules').delete().eq('user_id', session.user.id).eq('scheduled_on', schedule.scheduled_on).select('user_id');
      if (result.error) throw result.error;
      if (!result.data?.length) { setScheduleError('일정이 변경됐어요. 다시 불러온 뒤 확인해 주세요.'); return; }
      setSchedule(null); setConfirmCancel(false); setEditingSchedule(false);
      setNotice('앱에서 검진일을 삭제했어요. 치과 예약 취소는 치과에 직접 연락해 주세요.');
    } catch (err) { setScheduleError(friendlyError(err)); }
    finally { setBusy(false); }
  };

  const recordCheckup = async () => {
    if (!session || busy || checkups.some((c) => c.visited_on === localDateString())) return;
    setError('');
    setBusy(true);
    try {
      const today = new Date();
      const result = await db().from('checkups').insert({
        user_id: session.user.id,
        visited_on: localDateString(today),
      });
      if (result.error?.code === '23502') { setError('검진 기록 설정을 업데이트해야 해요. 앱 운영자에게 문의해 주세요.'); return; }
      if (result.error) throw result.error;
      await load();
    } catch (err) { setError(friendlyError(err)); }
    finally {
      setBusy(false);
    }
  };

  const fmt = (s: string) => {
    const d = new Date(s + 'T00:00:00');
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
  };

  return (
    <Screen>
      <Title sub="틀니도 정기 점검이 필요해요">치과 검진</Title>
      <ErrorBox message={error} />
      {error && <BigButton variant="ghost" onClick={() => { setError(''); void load(); }}>다시 불러오기</BigButton>}
      <p style={{ fontSize: 15, color: 'var(--text-sub)' }}>검진 시기는 담당 치과에서 개인 상태에 맞게 정해 주세요. 앱의 기존 자동 계산값은 검증된 개인별 권고가 아니에요.</p>

      {/* 다음 검진 D-day */}
      <Card style={{
        textAlign: 'center',
        background: dDay !== null && dDay <= 7 ? '#FEF2F2' : 'var(--primary-light)',
        borderColor: dDay !== null && dDay <= 7 ? 'var(--danger)' : 'var(--primary)',
      }}>
        {next ? (<>
          <p style={{ fontWeight: 700, color: 'var(--text-sub)' }}>{next.label}</p>
          {dDay !== null && <p style={{ fontSize: 34, fontWeight: 800, color: dDay <= 7 ? 'var(--danger)' : 'var(--primary)' }}>
            {dDay < 0 ? `${-dDay}일 지났어요` : dDay === 0 ? '오늘이에요!' : `D-${dDay}`}
          </p>}
          <p style={{ color: 'var(--text-sub)', marginTop: 4 }}>{fmt(next.date)}</p>
          {!next.confirmed && <p>검증되지 않은 기존 앱 계산값이며 치과 예약일이 아니에요. 실제 검진일은 담당 치과에 확인해 주세요.</p>}
        </>) : (<>
          <p style={{ fontWeight: 700, color: 'var(--text-sub)' }}>아직 안내받은 검진일이 없어요</p>
          <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)', margin: '6px 0' }}>
            담당 치과에 다음 일정을 확인해 주세요
          </p>
          <p style={{ color: 'var(--text-sub)' }}>안내받은 날짜를 아래에 입력해 주세요</p>
        </>)}
      </Card>

      <Card>
        <h2 style={{ fontSize: 21, marginBottom: 8 }}>치과에서 안내받은 일정</h2>
        <p>날짜를 저장하면 연결된 가족도 확인할 수 있어요. 치과 예약이나 예약 변경이 자동으로 접수되지는 않아요.</p>
        <ErrorBox message={scheduleError} />
        {(!scheduleReady || scheduleError) && <BigButton variant="ghost" disabled={busy} onClick={load}>일정 다시 불러오기</BigButton>}
        {notice && <p role="status">{notice}</p>}
        {scheduleReady && !editingSchedule && <BigButton variant="ghost" disabled={busy} onClick={() => { setDateInput(schedule?.scheduled_on ?? ''); setEditingSchedule(true); setConfirmCancel(false); setNotice(''); }}>{schedule ? '검진일 변경하기' : '안내받은 검진일 입력하기'}</BigButton>}
        {editingSchedule && <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
          <label style={{ display: 'grid', gap: 8 }}>담당 치과에서 정한 검진일
            <input type="date" value={dateInput} min={localDateString()} max="9999-12-31" disabled={busy} onChange={(event) => setDateInput(event.target.value)} style={{ width: '100%', minHeight: 56, fontSize: 'inherit' }} />
          </label>
          {dateInput && !isValidCheckupDate(dateInput) && <p role="alert">오늘 또는 이후의 올바른 날짜를 선택해 주세요.</p>}
          <BigButton disabled={busy || !isValidCheckupDate(dateInput)} onClick={saveSchedule}>{busy ? '저장 중...' : '검진일 저장하기'}</BigButton>
          <BigButton variant="ghost" disabled={busy} onClick={() => setEditingSchedule(false)}>돌아가기</BigButton>
        </div>}
        {schedule && !editingSchedule && !confirmCancel && <BigButton variant="ghost" disabled={busy} onClick={() => setConfirmCancel(true)}>앱에서 검진일 삭제하기</BigButton>}
        {confirmCancel && <div style={{ display: 'grid', gap: 12 }}>
          <p>앱에 저장한 날짜를 삭제할까요? 실제 치과 예약은 취소되지 않아요.</p>
          <BigButton variant="danger" disabled={busy} onClick={cancelSchedule}>{busy ? '삭제 중...' : '저장한 날짜 삭제'}</BigButton>
          <BigButton variant="ghost" disabled={busy} onClick={() => setConfirmCancel(false)}>유지하기</BigButton>
        </div>}
      </Card>

      {/* 사용 단계 */}
      {recall && (
        <Card>
          <p style={{ fontWeight: 800, marginBottom: 6 }}>
            지금은 「{recall.phase}」
          </p>
          <p style={{ color: 'var(--text-sub)' }}>{recall.note}</p>
          <p style={{ color: 'var(--text-sub)', marginTop: 8, fontSize: 15 }}>
            틀니 사용 {Math.floor(recall.monthsSince / 12) > 0 ? `${Math.floor(recall.monthsSince / 12)}년 ` : ''}
            {recall.monthsSince % 12}개월째
          </p>
        </Card>
      )}

      {/* 다니는 치과 */}
      {denture?.clinic_name && (
        <Card style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontWeight: 800 }}>🏥 {denture.clinic_name}</p>
            {denture.clinic_phone && <p style={{ color: 'var(--text-sub)' }}>{denture.clinic_phone}</p>}
          </div>
          {denture.clinic_phone && (
            <a href={`tel:${denture.clinic_phone}`} style={{
              background: 'var(--primary)', color: '#fff', fontWeight: 700,
              padding: '12px 20px', borderRadius: 12, textDecoration: 'none',
            }}>
              전화하기
            </a>
          )}
        </Card>
      )}

      <BigButton onClick={recordCheckup} disabled={busy || !scheduleReady || checkups.some((c) => c.visited_on === localDateString())}>
        {busy ? '기록 중...' : checkups.some((c) => c.visited_on === localDateString()) ? '오늘 검진을 기록했어요 ✓' : '오늘 검진 받았어요 ✓'}
      </BigButton>

      <p style={{ color: 'var(--text-sub)' }}>검진 기록을 남겨도 안내받은 일정은 유지돼요. 검진 후에는 다음 일정을 변경하거나 지난 일정을 삭제해 주세요.</p>

      {/* 검진 이력 */}
      {checkups.length > 0 && (
        <Card>
          <p style={{ fontWeight: 800, marginBottom: 10 }}>지난 검진</p>
          {checkups.map((c) => (
            <p key={c.id} style={{ color: 'var(--text-sub)', padding: '6px 0' }}>
              ✓ {fmt(c.visited_on)}
            </p>
          ))}
        </Card>
      )}
    </Screen>
  );
}
