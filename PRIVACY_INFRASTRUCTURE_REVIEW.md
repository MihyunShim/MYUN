# 서버·배포 설정 확인 기록

확인일: 2026-09-28. 개인정보처리방침 확정 문서가 아닙니다.

- 운영자/보호책임자: Mihyun Shim. 정정된 문의 이메일: allofdental.info@gmail.com.
- Supabase DentureCare: Free, 주 DB 싱가포르(ap-southeast-1). 대시보드에서 확인.
- 프로젝트 백업: Free에는 자동 백업이 포함되지 않으며 현재 백업 없음. 제공업체 내부 복제/보안 보관이 없다는 의미는 아님.
- Log Drains: 유료 업그레이드 안내 상태, 외부 전송 미설정.
- 인증 감사 로그 DB 저장: Write audit logs to the database 비활성. 기존 테이블 내 잔존 여부는 미확인.
- Custom SMTP: 비활성. Supabase 기본 메일 기능 사용.
- 공식 요금표: API/DB 로그 1일, Auth Audit Logs 1시간. 이 수치를 별도 auth.audit_log_entries 테이블이나 제공업체 내부 로그의 삭제 기한으로 해석하지 않음.
- Vercel: myun 프로젝트, Hobby. 공개 주소 myun-hazel.vercel.app의 배포는 main의 6ef0330. 최근 개발 브랜치는 미리보기 배포로 존재.
- Vercel Web Analytics: 활성화 안내 상태.
- VITE_SUPPORT_EMAIL을 Production과 Preview에 allofdental.info@gmail.com으로 저장 완료. 새 배포부터 적용.

공식 근거:
- https://supabase.com/pricing
- https://supabase.com/docs/guides/auth/audit-logs
- https://supabase.com/legal/customer-resources/data-processing-addendum
- https://supabase.com/legal/customer-resources/subprocessor-list

후속: 인증 감사 로그 DB 저장·정리 방식, 웹 제공업체의 처리 국가와 보관 조건을 문서에 반영하고 정책을 확정해야 합니다.
