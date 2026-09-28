import type { ConsentDetail, PrivacyNotice } from '../lib/privacy';

export function ConsentDetails({ detail }: { detail: ConsentDetail }) {
  return <dl className="privacy-details">{[['목적', detail.purpose], ['항목', detail.items], ['보유·이용기간', detail.retention], ['거부 권리와 영향', detail.refusal]].map(([k,v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>;
}
export function NoticeContent({ notice, showPolicyLink = true }: { notice: PrivacyNotice; showPolicyLink?: boolean }) {
  const d = notice.document;
  return <div className="privacy-copy">
    <p><strong>운영자: {d.operator}</strong></p><p>개인정보 보호책임자: {d.officer}</p><p>연락처: {d.contact}</p><p>시행일: {d.effectiveDate} · 버전: {notice.version}</p>
    {([['틀니 사용자 계정',d.account],['보호자 계정',d.guardian],['건강정보',d.health],['국외 이전',d.overseas],['가족에게 개인정보 제공',d.family],['가족에게 건강정보 제공',d.familyHealth],['초대코드 사용자에게 보호자 정보 제공',d.guardianShare]] as [string,ConsentDetail][]).map(([title,detail]) => <section key={title}><h3>{title}</h3><ConsentDetails detail={detail} /></section>)}
    <TransferDetails notice={notice} />
    {([['처리위탁',d.processors],['파기 방법·기간',d.destruction],['안전성 확보조치',d.safeguards],['기기에 저장하는 정보',d.localStorage],['열람·정정·삭제·처리정지·동의 철회',d.rights]]).map(([title,text]) => <section key={title}><h3>{title}</h3><p>{text}</p></section>)}
    <p>만 14세 이상을 대상으로 해요. 생년월일·주민등록번호는 받지 않아요. 광고·마케팅 동의를 요청하지 않아요.</p>
    <p>침해 상담: 개인정보침해 신고센터 118, 개인정보 분쟁조정위원회 1833-6972</p>
    {showPolicyLink && <a href={d.policyUrl} target="_blank" rel="noopener noreferrer">공개된 개인정보처리방침 열기</a>}
  </div>;
}
export function TransferDetails({ notice }: { notice: PrivacyNotice }) {
  return <div>{notice.document.transfers.map((t,i) => <section key={i}><h3>국외 이전 {i+1}</h3><dl className="privacy-details">
    {Object.entries({ '받는 자':t.recipient,'연락처':t.contact,'국가':t.countries,'이전 항목':t.items,'이용 목적':t.purpose,'시기·방법':t.timingMethod,'보유·이용기간':t.retention,'거부 방법·영향':t.refusal }).map(([k,v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
  </dl></section>)}</div>;
}
