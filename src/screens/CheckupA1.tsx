import { useEffect, useState, useCallback } from 'react';
import { db } from '../lib/db';
import { useAuth } from '../state/AuthContext';
import { calculateRecall } from '../lib/recall';
import { Screen, Title, Card, BigButton, Splash } from '../components/ui';

interface Denture {
  made_year: number;
  made_month: number;
  clinic_name: string | null;
  clinic_phone: string | null;
}
interface Checkup {
  id: string;
  visited_on: string;
  next_recall_on: string;
  interval_months: number;
}

// A1 치과 검진 화면 (docs/설계/01 A1-4): 리콜 D-day, 사용 단계, 검진 기록
export default function CheckupA1() {
  const { session } = useAuth();
  const [denture, setDenture] = useState<Denture | null>(null);
  const [checkups, setCheckups] = useState<Checkup[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!session) return;
    const [d, c] = await Promise.all([
      db().from('dentures').select('*').eq('user_id', session.user.id).maybeSingle(),
      db().from('checkups').select('*').eq('user_id', session.user.id).order('visited_on', { ascending: false }),
    ]);
    setDenture((d.data as Denture) ?? null);
    setCheckups((c.data as Checkup[]) ?? []);
    setLoading(false);
  }, [session]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <Splash text="검진 정보를 불러오는 중..." />;

  const recall = denture ? calculateRecall(denture.made_year, denture.made_month) : null;
  const latest = checkups[0] ?? null;

  // 다음 검진일: 검진 기록이 있으면 그 기록 기준, 없으면 권장 주기 안내만
  const nextDate = latest ? new Date(latest.next_recall_on + 'T00:00:00') : null;
  const dDay = nextDate ? Math.ceil((nextDate.getTime() - Date.now()) / 86400000) : null;

  const recordCheckup = async () => {
    if (!session || !recall) return;
    setBusy(true);
    try {
      const today = new Date();
      const next = new Date(today);
      next.setMonth(next.getMonth() + recall.intervalMonths);
      await db().from('checkups').insert({
        user_id: session.user.id,
        visited_on: today.toISOString().slice(0, 10),
        next_recall_on: next.toISOString().slice(0, 10),
        interval_months: recall.intervalMonths,
      });
      await load();
    } finally {
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

      {/* 다음 검진 D-day */}
      <Card style={{
        textAlign: 'center',
        background: dDay !== null && dDay <= 7 ? '#FEF2F2' : 'var(--primary-light)',
        borderColor: dDay !== null && dDay <= 7 ? 'var(--danger)' : 'var(--primary)',
      }}>
        {nextDate && dDay !== null ? (<>
          <p style={{ fontWeight: 700, color: 'var(--text-sub)' }}>다음 치과 가는 날</p>
          <p style={{ fontSize: 34, fontWeight: 800, color: dDay <= 7 ? 'var(--danger)' : 'var(--primary)' }}>
            {dDay < 0 ? `${-dDay}일 지났어요!` : dDay === 0 ? '오늘이에요!' : `D-${dDay}`}
          </p>
          <p style={{ color: 'var(--text-sub)', marginTop: 4 }}>{fmt(latest!.next_recall_on)}</p>
        </>) : (<>
          <p style={{ fontWeight: 700, color: 'var(--text-sub)' }}>아직 검진 기록이 없어요</p>
          <p style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)', margin: '6px 0' }}>
            {recall ? `${recall.intervalMonths}개월마다 점검을 권장해요` : '틀니 정보를 먼저 입력해주세요'}
          </p>
          <p style={{ color: 'var(--text-sub)' }}>치과에 다녀오시면 아래 버튼으로 기록해주세요</p>
        </>)}
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
            {recall.monthsSince % 12}개월째 · 권장 주기 {recall.intervalMonths}개월
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

      <BigButton onClick={recordCheckup} disabled={busy || !recall}>
        {busy ? '기록 중...' : '오늘 검진 받았어요 ✓'}
      </BigButton>

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
