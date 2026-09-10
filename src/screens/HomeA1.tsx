import { useEffect, useState, useCallback } from 'react';
import { db, friendlyError } from '../lib/db';
import { useAuth } from '../state/AuthContext';
import { SLOT_DETAIL, todayStr, EMERGENCY_TYPES, type Routine, type RoutineLog } from '../lib/types';
import { scheduleRoutines } from '../lib/notifications';
import { pickTodayTip, type DailyTip } from '../lib/tips';
import { Screen, Card, BigButton, Splash, ErrorBox } from '../components/ui';
import { isValidTime } from '../lib/dates';
import { useRefreshOnResume } from '../lib/useRefreshOnResume';

const TIP_DATE_KEY = 'denturecare:tip-shown-date';

// A1 홈: 오늘 할 일 (docs/설계/01 A1-1, A1-2 통합 초기 버전)
export default function HomeA1() {
  const { session, profile, signOut } = useAuth();
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [logs, setLogs] = useState<RoutineLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sendingSOS, setSendingSOS] = useState(false);
  const [savingTime, setSavingTime] = useState(false);
  const [checking, setChecking] = useState<string | null>(null);
  const [sosOpen, setSosOpen] = useState(false);
  const [sosSent, setSosSent] = useState(false);
  const [tip, setTip] = useState<DailyTip | null>(null);
  const [detail, setDetail] = useState<Routine | null>(null); // 항목 상세(행동 실행) 화면

  const load = useCallback(async () => {
    if (!session) return;
    const uid = session.user.id;
    try {
    const [r, l] = await Promise.all([
      db().from('routines').select('*').eq('user_id', uid).order('alarm_time'),
      db().from('routine_logs').select('*').eq('user_id', uid).eq('log_date', todayStr()),
    ]);
    if (r.error || l.error) throw r.error || l.error;
    setRoutines(((r.data as Routine[]) ?? []).filter((routine) => routine.enabled));
    setLogs((l.data as RoutineLog[]) ?? []);
    } catch (err) { setError(friendlyError(err)); }
    finally { setLoading(false); }
  }, [session]);

  useEffect(() => { load(); }, [load]);
  useRefreshOnResume(load);

  // 알림 예약 갱신 + 하루 한 번 정보 팝업
  useEffect(() => {
    if (routines.length === 0) return;
    void scheduleRoutines(routines).catch(() => setError('알림 시간을 적용하지 못했어요. 설정에서 다시 확인해주세요.'));
    let shown = false;
    try { shown = localStorage.getItem(`${TIP_DATE_KEY}:${session?.user.id}`) === todayStr(); } catch { /* 저장소를 사용할 수 없어도 관리는 계속 가능 */ }
    if (!shown) {
      setTip(pickTodayTip(profile?.birth_year ?? null));
    }
  }, [routines, profile?.birth_year, session?.user.id]);

  const closeTip = () => {
    try { localStorage.setItem(`${TIP_DATE_KEY}:${session?.user.id}`, todayStr()); } catch { /* 다음에 다시 안내 */ }
    setTip(null);
  };

  if (loading) return <Splash text="오늘 할 일을 불러오는 중..." />;

  const doneSlots = new Set<string>(logs.map((l) => l.slot));
  const done = routines.filter((r) => doneSlots.has(r.slot)).length;
  const next = routines.find((r) => !doneSlots.has(r.slot));

  const check = async (slot: string) => {
    if (!session || checking || doneSlots.has(slot)) return;
    setError('');
    setChecking(slot);
    // 서버에 기록 — 하루 1번 제약(unique)이 중복을 막아줌
    // log_date를 폰의 날짜로 명시 (서버는 UTC라 자정~아침 9시에 날짜가 어긋남)
    try {
    const result = await db().from('routine_logs').insert({ user_id: session.user.id, slot, log_date: todayStr() });
    if (result.error && result.error.code !== '23505') throw result.error;
    await load();
    setDetail(null); // 상세 화면에서 완료하면 홈으로
    } catch (err) { setError(friendlyError(err)); }
    finally { setChecking(null); }
  };

  // 완료 취소 (프로토타입 v12.2 계승): 오늘 기록만 삭제
  const uncheck = async (slot: string) => {
    if (!session || checking) return;
    setError('');
    setChecking(slot);
    try {
    const result = await db().from('routine_logs').delete()
      .eq('user_id', session.user.id).eq('slot', slot).eq('log_date', todayStr());
    if (result.error) throw result.error;
    await load();
    setDetail(null); // 취소 후 홈으로
    } catch (err) { setError(friendlyError(err)); }
    finally { setChecking(null); }
  };

  // 홈에서 바로 시간 변경 (프로토타입 계승): 즉시 저장 + 알림 재예약
  const changeTime = async (r: Routine, time: string) => {
    if (savingTime) return;
    if (!isValidTime(time)) { setError('관리 시간을 다시 골라주세요.'); return; }
    setError('');
    setSavingTime(true);
    try {
    const nextR = routines.map((x) => (x.id === r.id ? { ...x, alarm_time: time } : x));
    const result = await db().from('routines').update({ alarm_time: time }).eq('id', r.id).select('id').single();
    if (result.error) throw result.error;
    setRoutines(nextR);
    setDetail((d) => (d && d.id === r.id ? { ...d, alarm_time: time } : d));
    } catch (err) { setError(friendlyError(err)); }
    finally { setSavingTime(false); }
  };

  // 응급 도움 요청 → 보호자에게 알림 전송 (alerts 테이블)
  const sendSOS = async (typeId: string) => {
    if (!session || sendingSOS) return;
    setError('');
    setSendingSOS(true);
    try {
    const links = await db().from('care_links').select('id', { count: 'exact', head: true })
      .eq('elder_id', session.user.id).eq('status', 'active');
    if (links.error) throw links.error;
    if (!links.count) { setError('연결된 가족이 없어요. 가족이나 치과에 직접 전화해주세요.'); return; }
    const result = await db().from('alerts').insert({
      elder_id: session.user.id, type: 'emergency', detail: typeId,
    });
    if (result.error) throw result.error;
    setSosOpen(false);
    setSosSent(true);
    } catch (err) { setError(friendlyError(err)); }
    finally { setSendingSOS(false); }
  };

  const today = new Date();
  const dateLabel = `${today.getMonth() + 1}월 ${today.getDate()}일 ${'일월화수목금토'[today.getDay()]}요일`;

  // ===== 항목 상세 화면 (프로토타입 '지금 해야 할 일' 계승) =====
  if (detail) {
    const isDone = doneSlots.has(detail.slot);
    return (
      <Screen>
        <ErrorBox message={error} />
        <button onClick={() => setDetail(null)} style={{
          alignSelf: 'flex-start', background: 'none', color: 'var(--primary)',
          fontWeight: 700, fontSize: 18, minHeight: 44, padding: 0,
        }}>
          ← 뒤로
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{
            background: '#FDF1E3', color: 'var(--accent)', fontWeight: 800,
            padding: '8px 14px', borderRadius: 99, fontSize: 17,
          }}>
            {detail.label}
          </span>
          <input
            type="time"
            aria-label={`${detail.label} 관리 시간`}
            disabled={savingTime}
            value={detail.alarm_time.slice(0, 5)}
            onChange={(e) => changeTime(detail, e.target.value)}
            style={{
              fontSize: 17, fontWeight: 800, padding: '6px 12px',
              border: '1.5px solid var(--primary)', borderRadius: 99,
              background: 'var(--primary-light)', color: 'var(--primary)',
            }}
          />
        </div>

        <Card style={{ textAlign: 'center', padding: 28 }}>
          <p style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.5 }}>
            {SLOT_DETAIL[detail.slot].action}
          </p>
          <p style={{ color: 'var(--text-sub)', marginTop: 10, fontSize: 18 }}>
            🧴 {SLOT_DETAIL[detail.slot].tool}
          </p>
        </Card>

        {isDone ? (<>
          <Card style={{ background: '#F0FDF4', borderColor: 'var(--success)', textAlign: 'center' }}>
            <p style={{ fontWeight: 800, color: 'var(--success)', fontSize: 19 }}>✅ 이미 완료한 항목이에요</p>
          </Card>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <BigButton onClick={() => setDetail(null)}>돌아가기</BigButton>
            <button onClick={() => uncheck(detail.slot)} disabled={checking === detail.slot} style={{
              background: 'var(--surface)', color: 'var(--danger)',
              border: '2px solid #FECACA', fontWeight: 700, fontSize: 18,
              minHeight: 56, borderRadius: 12,
            }}>
              {checking === detail.slot ? '...' : '↩ 완료 취소'}
            </button>
          </div>
        </>) : (
          <BigButton onClick={() => check(detail.slot)} disabled={checking === detail.slot}>
            {checking === detail.slot ? '기록 중...' : '했어요 ✓'}
          </BigButton>
        )}
      </Screen>
    );
  }

  return (
    <Screen>
      <ErrorBox message={error} />
      {error && <BigButton variant="ghost" onClick={() => { setError(''); void load(); }}>다시 불러오기</BigButton>}
      {/* 오늘의 정보 팝업 (하루 1회) */}
      {tip && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div style={{
            background: 'var(--surface)', borderRadius: 20, padding: 24,
            maxWidth: 420, width: '100%', maxHeight: 'calc(100dvh - 80px)', overflowY: 'auto',
          }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>
              💡 오늘의 정보 · {tip.category}
            </p>
            <p style={{ fontSize: 40, textAlign: 'center', margin: '10px 0' }}>{tip.emoji}</p>
            <p style={{ fontSize: 21, fontWeight: 800, textAlign: 'center' }}>{tip.title}</p>
            <p style={{ color: 'var(--text)', textAlign: 'center', margin: '12px 0' }}>{tip.mainMessage}</p>
            <div style={{ background: 'var(--primary-light)', borderRadius: 12, padding: '10px 14px', marginBottom: 8 }}>
              <p style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 15 }}>{tip.detailLabel}</p>
              <p style={{ fontWeight: 700 }}>{tip.detail}</p>
            </div>
            <p style={{ color: 'var(--text-sub)', fontSize: 15, marginBottom: 16 }}>💬 {tip.tip}</p>
            <BigButton onClick={closeTip}>알겠어요</BigButton>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ color: 'var(--text-sub)' }}>{dateLabel}</p>
          <h1 style={{ fontSize: 24, fontWeight: 800 }}>
            {profile?.name ? `${profile.name}님, 안녕하세요!` : '안녕하세요!'}
          </h1>
        </div>
        <button onClick={signOut} style={{
          background: 'none', color: 'var(--text-sub)', fontSize: 15,
          textDecoration: 'underline', minHeight: 44,
        }}>
          로그아웃
        </button>
      </div>

      {/* 오늘 진행률 */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontWeight: 700 }}>오늘의 관리</span>
          <span style={{ fontWeight: 800, color: 'var(--primary)' }}>{done} / {routines.length} 완료</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {routines.map((r) => (
            <div key={r.slot} style={{
              flex: 1, height: 12, borderRadius: 6,
              background: doneSlots.has(r.slot) ? 'var(--success)' : 'var(--border)',
            }} />
          ))}
        </div>
        {done === routines.length && routines.length > 0 && (
          <p style={{ marginTop: 12, fontWeight: 800, color: 'var(--success)', textAlign: 'center' }}>
            오늘 관리를 모두 마쳤어요! 정말 잘하셨어요 👏
          </p>
        )}
      </Card>

      {/* 지금 할 일 (가장 큰 카드) */}
      {next && (
        <Card style={{ borderColor: 'var(--primary)', borderWidth: 2 }}>
          <p style={{ color: 'var(--primary)', fontWeight: 800 }}>
            ⏰ {next.alarm_time.slice(0, 5)} · {next.label}
          </p>
          <p style={{ fontSize: 22, fontWeight: 800, margin: '10px 0 4px' }}>
            {SLOT_DETAIL[next.slot].action}
          </p>
          <p style={{ color: 'var(--text-sub)', marginBottom: 16 }}>
            🧴 {SLOT_DETAIL[next.slot].tool}
          </p>
          <BigButton onClick={() => check(next.slot)} disabled={checking === next.slot}>
            {checking === next.slot ? '기록 중...' : '했어요 ✓'}
          </BigButton>
        </Card>
      )}

      {/* 응급 도움 요청 */}
      {sosSent ? (
        <Card style={{ background: '#F0FDF4', borderColor: 'var(--success)', borderWidth: 2, textAlign: 'center' }}>
          <p style={{ fontWeight: 800, color: 'var(--success)', fontSize: 20 }}>도움 요청을 남겼어요 ✓</p>
          <p style={{ color: 'var(--text-sub)', marginTop: 6 }}>가족이 앱을 열면 확인할 수 있어요. 바로 도움이 필요하면 가족이나 치과에 직접 전화해주세요.</p>
        </Card>
      ) : sosOpen ? (
        <Card style={{ borderColor: 'var(--danger)', borderWidth: 2 }}>
          <p style={{ fontWeight: 800, color: 'var(--danger)', fontSize: 20, marginBottom: 12 }}>어디가 불편하세요?</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {EMERGENCY_TYPES.map((t) => (
              <button key={t.id} onClick={() => sendSOS(t.id)} disabled={sendingSOS} style={{
                minHeight: 56, fontSize: 19, fontWeight: 700, textAlign: 'left',
                padding: '0 16px', background: '#FEF2F2', color: 'var(--danger)',
                border: '1px solid #FECACA', borderRadius: 12,
              }}>
                {t.icon} {t.label}
              </button>
            ))}
            <button onClick={() => setSosOpen(false)} style={{
              minHeight: 48, fontWeight: 700, background: 'var(--primary-light)', color: 'var(--primary)',
            }}>
              괜찮아요, 취소할게요
            </button>
          </div>
        </Card>
      ) : (
        <BigButton variant="danger" onClick={() => setSosOpen(true)}>🆘 아파요, 도움이 필요해요</BigButton>
      )}

      {/* 전체 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {routines.map((r) => {
          const isDone = doneSlots.has(r.slot);
          return (
            <Card key={r.slot} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '14px 16px', opacity: isDone ? 0.85 : 1, cursor: 'pointer',
            }}>
              <div onClick={() => setDetail(r)} style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                <span style={{ fontSize: 26 }}>{isDone ? '✅' : '⬜'}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700 }}>{r.alarm_time.slice(0, 5)} · {r.label} <span style={{ color: 'var(--text-sub)', fontWeight: 400, fontSize: 15 }}>›</span></p>
                  <p style={{ color: 'var(--text-sub)', fontSize: 16 }}>{SLOT_DETAIL[r.slot].action}</p>
                </div>
              </div>
              {!isDone && (
                <button onClick={() => check(r.slot)} disabled={checking === r.slot} style={{
                  background: 'var(--primary-light)', color: 'var(--primary)',
                  fontWeight: 700, padding: '0 18px', minHeight: 48,
                }}>
                  했어요
                </button>
              )}
            </Card>
          );
        })}
      </div>
    </Screen>
  );
}
