import { useEffect, useState } from 'react';
import { NoticeContent } from '../components/PrivacyNoticeContent';
import { BigButton, Card, ErrorBox, Screen, Title } from '../components/ui';
import { getPublicPrivacyNotice } from '../lib/publicPrivacy';
import type { PrivacyNotice } from '../lib/privacy';

export default function PublicPrivacy() {
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState<PrivacyNotice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const support = import.meta.env.VITE_SUPPORT_EMAIL as string | undefined;
  useEffect(() => {
    const previous = document.title;
    document.title = '개인정보처리방침 · 틀니케어';
    return () => { document.title = previous; };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setNotice(null); setError(''); setLoading(true);
    getPublicPrivacyNotice(controller.signal).then(value => {
      if (!controller.signal.aborted) setNotice(value);
    }).catch(() => {
      if (!controller.signal.aborted) setError('개인정보처리방침을 불러오지 못했어요. 인터넷 연결을 확인한 뒤 다시 시도해주세요.');
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });
    return () => controller.abort();
  }, [attempt]);
  return <Screen style={{ maxWidth: 800 }}>
    <main className="public-privacy" aria-busy={loading}>
      <a className="privacy-home" href="/">← 틀니케어 첫 화면</a>
      <Title sub="로그인 없이 확인할 수 있어요.">개인정보처리방침</Title>
      {loading ? <p role="status">개인정보처리방침을 불러오는 중...</p> : error ? <>
        <ErrorBox message={error} />
        <BigButton onClick={() => setAttempt(value => value + 1)}>다시 불러오기</BigButton>
      </> : notice ? <Card><NoticeContent notice={notice} showPolicyLink={false} /></Card> : <Card>
        <h2>개인정보 안내를 준비하고 있어요</h2>
        <p>현재 게시된 개인정보처리방침이 없습니다. 안내가 준비되기 전에는 새 가입이나 개인정보 동의를 진행할 수 없어요.</p>
        <BigButton variant="ghost" onClick={() => setAttempt(value => value + 1)}>게시 여부 다시 확인</BigButton>
      </Card>}
      {support && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(support) && <p className="privacy-contact">개인정보 문의: <a href={`mailto:${support}`}>{support}</a></p>}
    </main>
  </Screen>;
}
