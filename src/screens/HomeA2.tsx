import { useEffect, useState, useCallback } from 'react';
import { db } from '../lib/db';
import { useAuth } from '../state/AuthContext';
import { todayStr, EMERGENCY_TYPES, type Profile, type Routine, type RoutineLog, type Alert } from '../lib/types';
import { Screen, Card, Splash } from '../components/ui';

// A2 보호자 홈: 부모님 오늘 현황 + 알림 (docs/설계/01 A2-1, A2-3 통합 초기 버전)
export default function HomeA2() {
  const { elderId, profile, signOut } = useAuth();
  const [elder, setElder] = useState<Profile | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [logs, setLogs] = useState<RoutineLog[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!elderId) return;
    const [e, r, l, a] = await Promise.all([
      db().from('profiles').select('*').eq('id', elderId).single(),
      db().from('routines').select('*').eq('user_id', elderId).order('alarm_time'),
      db().from('routine_logs').select('*').eq('user_id', elderId).eq('log_date', todayStr()),
      db().from('alerts').select('*').eq('elder_id', elderId).order('created_at', { ascending: false }).limit(20),
    ]);
    setElder((e.data as Profile) ?? null);
    setRoutines((r.data as Routine[]) ?? []);
    setLogs((l.data as RoutineLog[]) ?? []);
    setAlerts((a.data as Alert[]) ?? []);
    setLoading(false);
  }, [elderId]);

  useEffect(() => { load(); }, [load]);

  // 실시간 구독: 부모님이 응급 신고하면 즉시 화면에 반영
  useEffect(() => {
    if (!elderId) return;
    const channel = db()
      .channel('guardian-alerts')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'alerts',
        filter: `elder_id=eq.${elderId}`,
      }, () => { load(); })
      .subscribe();
    return () => { db().removeChannel(channel); };
  }, [elderId, load]);

  if (loading) return <Splash text="가족 현황을 불러오는 중..." />;

  const doneSlots = new Set<string>(logs.map((l) => l.slot));
  const done = routines.filter((r) => doneSlots.has(r.slot)).length;
  const unreadEmergency = alerts.filter((a) => a.type === 'emergency' && !a.read_at);

  const markRead = async (id: string) => {
    await db().from('alerts').update({ read_at: new Date().toISOString() }).eq('id', id);
    await load();
  };

  const emergencyLabel = (detail: string | null) =>
    EMERGENCY_TYPES.find((t) => t.id === detail)?.label ?? detail ?? '도움 요청';

  const timeAgo = (iso: string) => {
    // 서버 시각에 시간대 표기가 없으면 UTC로 간주 (한국시간 +9시간 오차 방지)
    const normalized = /[zZ]|[+-]\d{2}/.test(iso.slice(10)) ? iso : iso + 'Z';
    const min = Math.floor((Date.now() - new Date(normalized).getTime()) / 60000);
    if (min < 1) return '방금 전';
    if (min < 60) return `${min}분 전`;
    if (min < 1440) return `${Math.floor(min / 60)}시간 전`;
    return `${Math.floor(min / 1440)}일 전`;
  };

  return (
    <Screen>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>
          {profile?.name ? `${profile.name}님, ` : ''}안녕하세요 💗
        </h1>
        <button onClick={signOut} style={{
          background: 'none', color: 'var(--text-sub)', fontSize: 15,
          textDecoration: 'underline', minHeight: 44,
        }}>
          로그아웃
        </button>
      </div>

      {/* 응급 알림 배너 (읽지 않은 것) */}
      {unreadEmergency.map((a) => (
        <Card key={a.id} style={{ background: '#FEF2F2', borderColor: 'var(--danger)', borderWidth: 2 }}>
          <p style={{ fontWeight: 800, color: 'var(--danger)', fontSize: 20 }}>
            🆘 {elder?.name}님: {emergencyLabel(a.detail)}
          </p>
          <p style={{ color: 'var(--text-sub)', margin: '6px 0 12px' }}>{timeAgo(a.created_at)}</p>
          <button onClick={() => markRead(a.id)} style={{
            background: 'var(--danger)', color: '#fff', fontWeight: 700,
            width: '100%', minHeight: 52,
          }}>
            확인했어요
          </button>
        </Card>
      ))}

      {/* 부모님 오늘 현황 */}
      <Card>
        <p style={{ color: 'var(--text-sub)' }}>나의 {alerts.length >= 0 && ''}{/* relation은 care_links에 있으나 간단히 이름으로 */}가족</p>
        <p style={{ fontSize: 22, fontWeight: 800, margin: '4px 0 14px' }}>
          {elder?.name ?? '연결된 가족'}님의 오늘
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontWeight: 700 }}>틀니 관리</span>
          <span style={{ fontWeight: 800, color: done === routines.length ? 'var(--success)' : 'var(--primary)' }}>
            {done} / {routines.length} 완료
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {routines.map((r) => (
            <div key={r.slot} style={{
              flex: 1, height: 12, borderRadius: 6,
              background: doneSlots.has(r.slot) ? 'var(--success)' : 'var(--border)',
            }} />
          ))}
        </div>
        {logs.length > 0 && (
          <p style={{ color: 'var(--text-sub)', marginTop: 12 }}>
            마지막 활동: {timeAgo(logs[logs.length - 1].done_at)}
          </p>
        )}
      </Card>

      {/* 알림 이력 */}
      <Card>
        <p style={{ fontWeight: 800, marginBottom: 10 }}>🔔 알림</p>
        {alerts.length === 0 && (
          <p style={{ color: 'var(--text-sub)' }}>아직 알림이 없어요. 좋은 소식이에요!</p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {alerts.map((a) => (
            <div key={a.id} style={{
              padding: '10px 12px', borderRadius: 10,
              background: a.read_at ? 'transparent' : 'var(--primary-light)',
              border: '1px solid var(--border)',
            }}>
              <p style={{ fontWeight: 700 }}>
                {a.type === 'emergency' ? `🆘 ${emergencyLabel(a.detail)}` : a.detail}
              </p>
              <p style={{ color: 'var(--text-sub)', fontSize: 15 }}>{timeAgo(a.created_at)}</p>
            </div>
          ))}
        </div>
      </Card>
    </Screen>
  );
}
