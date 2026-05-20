# Week 1 — Hướng dẫn setup (dành cho owner: Minh Đức)

> Claude Code **không tạo tài khoản hay nhập secret thay anh** (quy tắc an toàn).
> Anh tự tạo account + dán credentials vào Vercel env / `.env.local`.
> Toàn bộ code Week 1 đã viết theo kiểu *graceful-degrade*: thiếu env thì
> auth/quota cho qua (allow-through) — nên local/test không bao giờ vỡ.

§9 đã chốt: **Supabase project RIÊNG · WCAG 2.2 AA · commit thẳng main · giữ đủ 12 tuần.**

---

## 1. Tạo Supabase project riêng (P0)

1. https://supabase.com → **New project** → đặt tên `desygn-a11y-prod`.
2. (Khuyến nghị) tạo thêm `desygn-a11y-staging` để test migration trước.
3. Lấy 2 giá trị ở **Project Settings → API**:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` secret → `SUPABASE_SERVICE_ROLE_KEY` (⚠️ server-only)
   - `anon` public key → `VITE_SUPABASE_ANON_KEY` (cho dashboard client)

## 2. Áp migrations 005–008 (P0)

Các file đã có sẵn trong `supabase/migrations/`. Áp lên **staging trước**, test, rồi prod:

```bash
npx supabase login
npx supabase link --project-ref <ref-cua-staging>
npx supabase db push          # áp 001→008 theo thứ tự
# kiểm tra: bảng subscriptions, teams, team_members, usage_events,
#           a11y_rules (đã seed 7 rule), audit_issues, audit_queue, api_keys
npx supabase db push --linked # rồi lặp lại với project prod
```

> Migration 006 tự seed 7 rule WCAG vào `a11y_rules`. RLS đã bật sẵn cho mọi bảng.

## 3. Bật Supabase Auth (P0)

**Authentication → Providers:**
- Email/password: bật (xác minh email).
- Google OAuth: tạo Client ID ở Google Cloud Console → dán vào Supabase.
- GitHub OAuth: tạo OAuth App trên GitHub → dán Client ID/Secret vào Supabase.

**Authentication → URL Configuration:** thêm redirect `http://127.0.0.1:5180/**` (dev) và domain prod sau.

## 4. Upstash Redis (P1)

https://upstash.com → tạo Redis database → copy **REST URL** + **REST Token**:
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`

(Dùng cho rate-limit đã có + hourly API quota của `quota.ts`.)

## 5. Report signing secret (P1)

```bash
openssl rand -base64 32   # dán vào REPORT_SIGNING_SECRET
```

## 6. Điền env vars

- **Local:** copy `.env.local.example` → `.env.local`, điền các giá trị trên.
- **Vercel:** Project Settings → Environment Variables, thêm các biến **không** có tiền tố `VITE_` cho server, và `VITE_*` cho client.

---

## Đã xong phía code (Claude, Week 1)

| Thành phần | File | Trạng thái |
|---|---|---|
| Admin Supabase client (lazy, degrade null) | `api/lib/supabase-admin.ts` | ✅ + test |
| Auth: Supabase JWT (jose JWKS) + API key (sha256) | `api/lib/auth.ts` | ✅ + 16 test |
| Quota theo tier (audit/tháng, api/giờ) | `api/lib/quota.ts` | ✅ + 10 test |
| Rate limit Upstash | `api/lib/rate-limit.ts` | ✅ (từ P2) |
| Migrations 005–008 + seed rule + RLS | `supabase/migrations/` | ✅ (chờ owner `db push`) |

## Acceptance Week 1 (kiểm khi đã có account)

- [ ] Signup/login chạy trên staging
- [ ] JWT verify trả đúng `userId` + `tier`
- [ ] `checkQuota` trả `remaining` đúng theo tier
- [ ] Rate limit trả 429 khi vượt
- [ ] `npm test` xanh (hiện đã 1857/1857 với phần code Week 1)

Khi mục 1–6 xong, báo Claude để sang **Week 2 còn lại / Week 3** (app shell + auth flow) — hoặc tiếp tục phần offline của các tuần sau.
