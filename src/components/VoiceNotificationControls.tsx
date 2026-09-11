import { useEffect, useRef, useState } from 'react';
import { BigButton, ErrorBox } from './ui';
import { CARE_VOICE_TEXT, getVoiceStatus, prepareVoice, previewVoice, setVoiceNotificationsEnabled,
  voiceErrorMessage, voiceNotificationsEnabled, type VoiceStatus } from '../lib/voiceNotifications';

export function VoiceNotificationControls({ disabled, onChange, onBusyChange }: {
  disabled: boolean; onChange: () => void; onBusyChange: (busy: boolean) => void;
}) {
  const [enabled, setEnabled] = useState(voiceNotificationsEnabled);
  const [status, setStatus] = useState<VoiceStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [previewEnded, setPreviewEnded] = useState(false);
  const operation = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    void getVoiceStatus().then((value) => { if (mounted.current) setStatus(value); })
      .catch((err) => { if (mounted.current) setError(voiceErrorMessage(err)); });
    return () => { mounted.current = false; };
  }, []);

  const run = async (action: 'preview' | 'repair') => {
    if (disabled || operation.current) return;
    operation.current = true; setBusy(true); onBusyChange(true);
    setError(''); setNotice(''); setPreviewEnded(false);
    try {
      if (action === 'repair') {
        await prepareVoice(true);
        if (mounted.current) { setNotice('음성을 다시 준비했어요. 아래에서 알림을 다시 적용해주세요.'); onChange(); }
      } else {
        await previewVoice();
        if (mounted.current) setPreviewEnded(true);
      }
      const value = await getVoiceStatus();
      if (mounted.current) setStatus(value);
    } catch (err) {
      if (mounted.current) setError(err instanceof Error && err.message.startsWith('VOICE_PREPARATION_FAILED: ')
        ? err.message.slice('VOICE_PREPARATION_FAILED: '.length) : voiceErrorMessage(err));
    } finally {
      operation.current = false;
      if (mounted.current) { setBusy(false); onBusyChange(false); }
    }
  };

  return <div style={{ display: 'grid', gap: 10, margin: '12px 0' }}>
    <fieldset disabled={disabled || busy} style={{ border: 0, minWidth: 0 }}>
      <legend style={{ fontWeight: 700 }}>알림 소리</legend>
      {[{ value: true, label: '음성 안내' }, { value: false, label: '기본 알림음' }].map((option) =>
        <label key={String(option.value)} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 48 }}>
          <input type="radio" name="notification-sound" checked={enabled === option.value} onChange={() => {
            try {
              setVoiceNotificationsEnabled(option.value); setEnabled(option.value); setError(''); onChange();
              setNotice('소리를 선택했어요. 아래에서 알림을 다시 적용해주세요.'); setPreviewEnded(false);
            } catch { setError('선택을 저장하지 못했어요. 다시 시도해주세요.'); }
          }} />{option.label}
        </label>)}
    </fieldset>
    {enabled && <>
      <p>“{CARE_VOICE_TEXT}”라고 한 번 안내해요.</p>
      <p role="status">{busy ? '음성을 준비하거나 재생하고 있어요. 앱을 잠시 켜두세요.'
        : status?.ready ? '음성 안내가 준비됐어요. 미리 듣기로 목소리를 확인해주세요.'
          : '처음 사용하거나 음성이 안 들리면 아래에서 준비 상태를 확인해주세요.'}</p>
      <BigButton variant="ghost" disabled={disabled || busy} onClick={() => void run('preview')}>목소리 미리 듣기</BigButton>
      <BigButton variant="ghost" disabled={disabled || busy} onClick={() => void run('repair')}>음성 다시 준비하기</BigButton>
      {previewEnded && <p role="status">미리 듣기를 마쳤어요. 문장이 들렸다면 아래의 10초 시험 알림을 눌러 화면을 잠가 확인해주세요. 기본음만 들리면 음성 다시 준비하기를 눌러주세요.</p>}
      <p>미리 듣기와 잠금 화면 알림의 소리는 별도로 확인해주세요. 알림은 아이폰의 무음·집중 모드·알림 음량 설정을 따라요.</p>
    </>}
    <ErrorBox message={error} />
    {notice && <p role="status">{notice}</p>}
  </div>;
}
