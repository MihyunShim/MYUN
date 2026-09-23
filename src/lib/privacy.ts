import { useCallback, useEffect, useState } from 'react';
import { db, friendlyError } from './db';
export interface ConsentDetail { purpose: string; items: string; retention: string; refusal: string }
export interface PrivacyDocument {
  operator: string; contact: string; officer: string; effectiveDate: string; policyUrl: string;
  destruction: string; safeguards: string; processors: string; localStorage: string; rights: string;
  transfers: { recipient: string; contact: string; countries: string; items: string; purpose: string; timingMethod: string; retention: string; refusal: string }[];
  account: ConsentDetail; guardian: ConsentDetail; health: ConsentDetail; overseas: ConsentDetail;
  family: ConsentDetail; familyHealth: ConsentDetail; guardianShare: ConsentDetail;
}
export interface PrivacyNotice { version: string; document: PrivacyDocument }
export interface ConsentChoices { age14: boolean; personal: boolean; sensitive: boolean; overseas: boolean }
export const emptyChoices = (): ConsentChoices => ({ age14: false, personal: false, sensitive: false, overseas: false });
export const canAccept = (notice: PrivacyNotice | null, choices: ConsentChoices) => !!notice && choices.age14 && choices.personal && choices.overseas;
export function usePrivacyNotice() {
  const [notice, setNotice] = useState<PrivacyNotice | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true); setError(''); setNotice(null);
    try { const r = await db().rpc('get_privacy_notice'); if (r.error) throw r.error; setNotice(r.data); }
    catch (e) { setError(friendlyError(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  return { notice, error, loading, reload };
}
