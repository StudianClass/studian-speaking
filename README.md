# Studian Speaking — Vite/React App

## 환경변수 설정 (필수)

Vercel 대시보드 → 프로젝트 선택 → **Settings → Environment Variables** 에서 아래 항목을 등록하세요.

| Name | 설명 |
|------|------|
| `ANTHROPIC_API_KEY` | Anthropic 콘솔에서 발급한 API 키 (`sk-ant-...`) |

> API 키는 `/api/chat` 서버리스 함수에서만 사용됩니다. 클라이언트 번들에는 포함되지 않습니다.

## 로컬 개발

```bash
npm install

# .env.local 파일 생성 후 키 입력
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local

# vercel dev 로 실행 (서버리스 함수 포함)
npx vercel dev
```

## 배포

`main` 브랜치에 push 하면 Vercel이 자동으로 재배포합니다.
