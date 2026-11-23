# Fareed AI Proxy — Gemini untuk Prince Fareed

Folder ini ialah **Cloudflare Worker** kecil yang membolehkan Prince Fareed
menjawab sembang Sarah menggunakan **Google Gemini**, tanpa mendedahkan API key.

```
Game (GitHub Pages)  ──POST /chat──▶  Cloudflare Worker  ──(API key, rahsia)──▶  Google Gemini
        ▲                                   │
        └──────────── { reply } ◀───────────┘
```

- API key **hanya** disimpan di Cloudflare sebagai *secret* `GEMINI_API_KEY`.
  Ia tidak ada dalam game, tidak ada dalam GitHub, dan tidak ada dalam fail ini.
- Jika Worker atau Gemini tidak dapat dihubungi, game terus berfungsi:
  Prince Fareed menjawab dengan balasan *offline* dan memaparkan nota kecil.

## Fail-fail

| Fail | Kegunaan |
| --- | --- |
| `src/worker.ts` | Kod Worker: CORS, pengesahan input, had kadar (rate limit), timeout, panggilan Gemini, mesej ralat. |
| `src/persona.ts` | **Personaliti AI Prince Fareed** (cara dia bercakap). Edit di sini. |
| `src/index.ts` | Titik masuk (hanya `export default`). |
| `worker-dashboard.js` | **Fail siap untuk ditampal ke Cloudflare Dashboard** — dijana automatik, jangan edit terus. |
| `wrangler.toml` | Hanya untuk deploy melalui CLI (pilihan). |

Selepas mengubah `src/worker.ts` atau `src/persona.ts`, jana semula fail dashboard:

```bash
npm run proxy:bundle      # di folder utama projek
```

(Ujian `npm test` akan gagal jika `worker-dashboard.js` tidak dikemas kini.)

---

## Deploy melalui Cloudflare Dashboard (langkah demi langkah)

> ⚠️ Lakukan hanya selepas anda bersetuju dengan implikasi privasi Gemini Free
> Tier (lihat bahagian **Privasi** di bawah). Label butang dalam dashboard
> mungkin berbeza sedikit mengikut kemas kini Cloudflare.

### Langkah 1 — Buka Worker anda
1. Log masuk ke <https://dash.cloudflare.com>.
2. Menu kiri: **Workers & Pages** (di bawah *Compute*).
3. Klik Worker **`fareed-ai-proxy`**.

### Langkah 2 — Semak secret API key (jangan dedahkan)
1. Tab **Settings** → bahagian **Variables and Secrets**.
2. Pastikan ada entri **`GEMINI_API_KEY`** dengan jenis **Secret**
   (nilainya tersembunyi — itu betul). Jika tiada: **+ Add** → Type **Secret**
   → Name `GEMINI_API_KEY` → tampal key dari Google AI Studio → **Deploy**.
3. Jangan sekali-kali salin key ke dalam kod, GitHub, mesej atau tangkapan skrin.

### Langkah 3 — (Pilihan) pemboleh ubah biasa
Dalam **Variables and Secrets** yang sama, **+ Add** → Type **Text**:

| Name | Value | Wajib? |
| --- | --- | --- |
| `ALLOWED_ORIGINS` | `https://fareedersyad.github.io,http://localhost:5173,http://localhost:4173` | Tidak — nilai ini sudah menjadi lalai dalam kod. |
| `GEMINI_MODEL` | `gemini-3.5-flash-lite` | Tidak — ini model lalai. |

> `ALLOWED_ORIGINS` ialah alamat laman (tanpa `/game-for-bday-sarah`), dipisahkan koma.

### Langkah 4 — Tampal kod baharu
1. Kembali ke halaman Worker → klik **Edit code** (ikon `</>`).
2. Dalam editor, buka `worker.js` (atau fail utama yang ada), **padam semua**
   kod "Hello World".
3. Buka fail `proxy/worker-dashboard.js` dalam VS Code → **Ctrl+A**, **Ctrl+C**
   → tampal (**Ctrl+V**) ke dalam editor Cloudflare.
4. Klik **Deploy** (butang biru, kanan atas) → sahkan.

### Langkah 5 — Uji
1. Buka dalam pelayar: `https://fareed-ai-proxy.<akaun-anda>.workers.dev/health`
   Jawapan sepatutnya: `{"ok":true,"service":"fareed-ai-proxy","endpoint":"POST /chat","configured":true}`
   - `configured:false` bermaksud secret `GEMINI_API_KEY` belum ditetapkan.
2. Uji sembang sebenar (Git Bash / Terminal):
   ```bash
   curl -X POST "https://fareed-ai-proxy.<akaun-anda>.workers.dev/chat" \
     -H "Origin: http://localhost:5173" -H "Content-Type: application/json" \
     -d '{"messages":[{"role":"user","content":"Sayang, saya lapar"}],"context":"Location: garden."}'
   ```
   Jawapan berjaya: `{"reply":"…","model":"gemini-3.5-flash-lite"}`.
3. Log ringkas (tanpa isi mesej): halaman Worker → **Observability / Logs**.

### Langkah 6 — Sambungkan game
URL Worker ialah **awam** (bukan rahsia).
- **Komputer sendiri:** fail `.env.local` di folder utama (sudah disediakan):
  `VITE_AI_PROXY_URL=https://fareed-ai-proxy.<akaun-anda>.workers.dev`
  kemudian `npm run dev`.
- **GitHub Pages:** repo GitHub → **Settings → Secrets and variables → Actions
  → Variables → New repository variable** → Name `VITE_AI_PROXY_URL`, Value
  URL di atas. Workflow deploy akan menggunakannya pada build seterusnya.

---

## API

`POST /chat` — `Content-Type: application/json`

```json
{
  "messages": [
    { "role": "user", "content": "Hai sayang" },
    { "role": "assistant", "content": "Hai cantik! Ada apa?" },
    { "role": "user", "content": "Saya lapar" }
  ],
  "context": "Location: garden. Current quest: …"
}
```

- `messages`: perbualan mengikut **urutan masa** (lama → baharu), mesti berakhir dengan mesej Sarah (`user`).
  Hanya 16 giliran terkini dihantar ke Gemini.
- Berjaya: `200 { "reply": "…", "model": "…" }` (tambah `"blocked": true` jika Gemini menolak atas sebab keselamatan).
- Ralat: `{ "error": { "code": "…", "message": "…" } }`

| Status | `code` | Maksud |
| --- | --- | --- |
| 400 | `invalid_json`, `invalid_messages` | Permintaan tidak sah |
| 403 | `origin_not_allowed` | Laman lain cuba guna proxy |
| 413 / 415 | `payload_too_large` / `unsupported_media_type` | Terlalu besar / bukan JSON |
| 429 | `rate_limited` / `upstream_rate_limited` | Terlalu banyak mesej / had Free Tier Gemini |
| 500 | `not_configured` | Secret `GEMINI_API_KEY` tiada |
| 502 | `upstream_auth`, `upstream_model`, `upstream_error`, `upstream_empty`, `upstream_bad_request` | Masalah di pihak Gemini / key / model |
| 504 | `upstream_timeout` | Gemini lambat (>15 s) |

`GET /health` — semakan status (tidak memanggil Gemini, tidak mendedahkan key).

## Langkah keselamatan dalam kod

- CORS: hanya `https://fareedersyad.github.io` dan `localhost:5173/4173` (atau `ALLOWED_ORIGINS`).
  Permintaan tanpa `Origin` yang dibenarkan ditolak. (Nota: alat bukan pelayar boleh memalsukan
  `Origin`; perlindungan sebenar ialah had kadar + had Free Tier.)
- Pengesahan: peranan `user`/`assistant` sahaja, maks 800 aksara setiap mesej, badan maks 32 KB,
  aksara kawalan dibuang, giliran berturut-turut digabung, urutan dikekalkan.
- Had kadar (anggaran, per instance Worker): 8 mesej/minit dan 150/hari bagi setiap IP.
- Timeout 15 s ke Gemini; satu cubaan semula pantas untuk ralat 500/503 sahaja.
- API key dihantar dalam header `x-goog-api-key` (bukan dalam URL), tidak pernah dilog
  atau dipulangkan. Log hanya mengandungi kiraan dan kod — **bukan isi mesej Sarah**.
- Balasan dibersihkan: tiada markdown, panjang terhad, dan "aku/kau/engkau/kamu" ditukar
  kepada "saya/awak" sebagai lapisan terakhir.
- **Jangan aktifkan billing** pada projek Google AI Studio ini jika mahu kekal percuma:
  tanpa billing, penyalahgunaan paling teruk hanya mencapai had kuota (429), bukan caj.

## Privasi (Gemini Free Tier) — baca sebelum guna

Menurut terma Google (<https://ai.google.dev/gemini-api/terms>):
- Pada **Free Tier**, mesej dan jawapan **boleh dibaca oleh penilai manusia** dan digunakan untuk
  memperbaiki produk Google (dipisahkan daripada akaun/API key). Google menasihatkan **jangan
  hantar maklumat sensitif atau peribadi**.
- Data disimpan sementara untuk pemantauan penyalahgunaan (lihat
  <https://ai.google.dev/gemini-api/docs/logs-policy>).
- Pada **Paid Tier**, data tidak digunakan untuk memperbaiki produk.
- Had Free Tier (mesej per minit/hari) berubah dari semasa ke semasa — semak dalam AI Studio
  (<https://ai.google.dev/gemini-api/docs/rate-limits>).

Sebab itu persona **tidak** mengandungi kenangan peribadi, dan `SHARED_MEMORIES` (Bintang
Kenangan dalam game) **tidak pernah** dihantar ke Gemini. Ruang sembang memaparkan nota
privasi kepada Sarah apabila Gemini aktif (teks boleh diubah dalam `personalContent.ts`).
