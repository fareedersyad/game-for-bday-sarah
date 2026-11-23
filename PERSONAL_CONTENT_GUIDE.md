# Panduan Mengubah Kandungan Peribadi (untuk beginner)

Semua teks yang Sarah nampak dalam game — nama, surat, mesej, dialog, misi,
barang, lokasi, butang dan notifikasi — kini berada dalam **satu fail sahaja**:

```
src/config/personalContent.ts
```

Fail ini **tidak mengandungi logik game**. Mengubah teks di sini tidak akan
merosakkan misi, gameplay atau sistem simpanan (save).

> 💡 Cara buka fail dalam VS Code: tekan **Ctrl+P**, taip `personalContent`,
> tekan **Enter**. Untuk mencari sesuatu dalam fail: **Ctrl+F**.

---

## Peraturan emas (baca dulu!)

1. **Ubah teks di antara tanda petik sahaja:** `'seperti ini'`.
2. Jika teks anda ada tanda `'` (apostrophe), tulis `\'` — contoh: `'Princess\'s room'` —
   atau gunakan petik berganda: `"Princess's room"`.
3. **Jangan padam koma** `,` di hujung baris.
4. **Jangan tukar perkataan sebelum titik bertindih** (contoh `title:`, `body:`) dan
   **jangan tukar mana-mana `id`** (contoh `id: 'note_bench'`). Game menggunakan nama itu.
5. Token ini diganti secara automatik — biarkan seperti asal:
   - `{HER_NAME}` → nama Sarah · `{YOUR_NAME}` → nama Fareed
   - `{HER_NICKNAME}` → panggilan Sarah · `{YOUR_NICKNAME}` → panggilan Fareed
   - `{count}`, `{total}`, `{title}`, `{flower}` … → nombor/nama yang diisi oleh game
6. Dalam surat, `\n\n` bermaksud **perenggan baru**.
7. Gunakan **"saya"** dan **"awak"** sahaja — jangan "aku", "kau", "engkau" atau "kamu".
   (Ada ujian automatik yang memeriksa perkara ini.)

### Isi kandungan fail (cari nombor ini dengan Ctrl+F, contoh `// 3.`)

| Bahagian | Kandungan |
| --- | --- |
| `// 1.` NAMA | Nama Sarah, Fareed, panggilan, tarikh lahir, nama penutur |
| `// 2.` GELARAN & PEMBUKAAN | Kad gelaran diraja, skrin pembukaan |
| `// 3.` SURAT | Surat cinta, mesej akhir, surat terakhir |
| `// 4.` MESEJ KHAS | Hadiah, Bintang Kenangan, buku, taman, cermin, mahkamah, kanak-kanak, ribut, strawberry, kek hari jadi, kredit |
| `// 5.` PRINCE FAREED | Nota personaliti (offline) |
| `// 6.` DIALOG | Semua perbualan Fareed, Sarah dan watak lain |
| `// 7.` MISI | Tajuk, penerangan, objektif dan petunjuk misi |
| `// 8.` BARANG | Nama & penerangan barang dalam Inventori |
| `// 9.` LOKASI | Nama tempat & penerangan |
| `// 10.` TEKS CERITA | Banner, notifikasi, teks butang tindakan |
| `// 11.` TEKS SKRIN & BUTANG | Skrin tajuk, menu, Jurnal, peta, tetapan, simpanan… |

---

## 1. Menukar nama Sarah

**Fail:** `src/config/personalContent.ts` → bahagian `// 1. NAMA`

```ts
    HER_NAME: 'Sarah',
```

Nama ini digunakan di seluruh game melalui `{HER_NAME}` (contoh "Princess Sarah"
pada kad gelaran, gelembung dialog dan kredit), jadi anda hanya perlu ubah **satu tempat**.

> ⚠️ AI Fareed (Gemini) mempunyai nama Sarah dalam fail personanya sendiri:
> `proxy/src/persona.ts`. Jika menukar nama, ubah juga di situ dan deploy semula
> Worker (lihat bahagian 10).

## 2. Menukar nama Fareed

**Fail yang sama**, bahagian `// 1. NAMA`:

```ts
    YOUR_NAME: 'Fareed',
```

Ini mengubah "Prince Fareed" di atas dialog, tandatangan surat (`— {YOUR_NAME}`) dan
"Dibina dengan cinta oleh …" dalam kredit. Untuk AI, ubah juga `proxy/src/persona.ts`.

## 3. Menukar nama panggilan

Bahagian `// 1. NAMA`:

```ts
    HER_NICKNAME: 'sayang',          // cara Fareed memanggil Sarah (di tempat yang guna {HER_NICKNAME})
    YOUR_NICKNAME: 'awak punya putera',
```

Banyak ayat dialog menulis perkataan "sayang" atau "princess" terus dalam ayat
(bukan sebagai token). Untuk mengubahnya, guna **Ctrl+F** → cari `sayang` dan
ubah ayat yang anda mahu satu per satu.

Nama penutur di atas gelembung dialog ada di `speakerNames` (bahagian 1):

```ts
    him: 'Prince {YOUR_NAME}',
    her: 'Princess {HER_NAME}',
```

## 4. Menukar love letter (surat cinta)

Bahagian `// 3. SURAT` → `loveLetter`:

```ts
  loveLetter: {
    title: 'Untuk wanita kesayangan saya',      // tajuk kecil di atas surat
    body:
      'Assalamualaikum, wanita kesayangan saya.\n\n' +
      'Selamat hari lahir, sayang.\n\n' +
      …
      'Dan jangan risau, saya ada di sini menemani awak.',   // ← baris terakhir TIADA  + 
    signOff: 'With all my love.',               // ayat penutup
    signature: '— {YOUR_NAME}',                 // tandatangan
  } satisfies LetterContent,
```

Setiap baris badan surat ialah satu perenggan, berakhir dengan `\n\n' +`.
**Baris terakhir** berakhir dengan `',` sahaja (tanpa `\n\n` dan tanpa `+`).

## 5. Menukar final letter (surat terakhir)

Ada **dua** mesej penutup:

| Nama dalam fail | Di mana muncul |
| --- | --- |
| `finalSecretLetter` | Surat atas meja di **Bilik Rahsia** (kejutan paling akhir) |
| `finalMessage` | Mesej di **Bukit Bunga Api** (`intro` = dua ayat pembuka, `body` = mesej, `button` = teks butang) |

Cara mengubahnya sama seperti surat cinta (bahagian 4 di atas).

## 6. Menukar dialog Fareed

Bahagian `// 6. DIALOG`. Setiap babak ialah senarai baris `['penutur', 'teks']`:

```ts
    bouquet: [
      ['him', 'Saya tahu awak suka bunga.'],
      ['him', 'Jadi, ini bunga pertama daripada saya untuk awak.'],
    ],
```

Penutur: `'him'` = Fareed · `'her'` = Sarah · `'narrator'` = narator ·
`'momo'`, `'bunny'`, `'mirror'`, `'judge'` = watak lain.

Tempat lain dalam bahagian 6:

| Nama | Apa |
| --- | --- |
| `barks` | Komen spontan Fareed mengikut lokasi |
| `arrivals` | Ayat pertama kali sampai ke sesuatu tempat |
| `talk` | Menu "Bercakap dengan dia" (salam, manja, cerita tempat…) |
| `freeChat` | Balasan **offline** untuk "Sembang bebas" (bila AI tiada) |

Dalam `freeChat.rules`, setiap peraturan ada `match` (perkataan yang dicari dalam
mesej Sarah) dan `replies` (pilihan balasan):

```ts
        { match: ['lapar', 'makan', 'hungry'], replies: ['Jom makan! Saya belanja. Dalam dunia ni semua free, hehe.', 'Awak dah makan belum? Jangan skip makan tau.'] },
```

### AI Fareed (Gemini)

Personaliti AI **bukan** dalam `personalContent.ts`. Ia disimpan di
`proxy/src/persona.ts` (di pelayan Cloudflare) supaya tiada sesiapa boleh mengubahnya
dari pelayar. Selepas mengedit, jalankan `npm run proxy:bundle` dan tampal semula
`proxy/worker-dashboard.js` ke Cloudflare (lihat `proxy/README.md`).
Jangan tulis maklumat peribadi sensitif di situ — pada Gemini Free Tier, Google
boleh membenarkan manusia membaca mesej.

## 7. Menukar quest messages (mesej misi)

Bahagian `// 7. MISI`. Setiap misi:

```ts
    garden: {
      chapter: 'Pengembaraan',
      name: 'Taman Impian',                         // tajuk misi
      description: 'Taman yang luas penuh bunga…',  // penerangan dalam Jurnal
      objectives: {
        flowers: 'Kutip bunga ajaib',               // senarai objektif
        bloom: 'Tanam & siram benih ajaib',
        notes: 'Cari nota tersembunyi',
      },
      hint: 'Taman bunga di timur…',                // petunjuk daripada Fareed
    },
```

Ubah teks sahaja — **jangan** ubah `garden`, `flowers`, `bloom`, `notes` (itu id).
Bilangan yang perlu dikutip (contoh 10 bunga) ialah tetapan gameplay dan berada
dalam `src/config/questConfig.ts` / `gameConfig.ts` — tidak perlu diubah.

Notifikasi kecil semasa bermain (contoh "Tulip dikutip · 3/10") dan banner besar
(contoh "ROYAL PALACE UNLOCKED") ada dalam `// 10. TEKS CERITA`:

```ts
      flowerPicked: '{flower} dikutip · {count}/{total}',
```

Biarkan `{flower}`, `{count}` dan `{total}` — game mengisinya sendiri.

## 8. Menambah perenggan atau halaman surat

**Tambah perenggan:** tambah satu baris baharu dalam `body`, sebelum baris terakhir:

```ts
      'Ada banyak kejutan yang saya sediakan.\n\n' +
      'Perenggan baharu saya di sini.\n\n' +          // ← baris baharu
      'Dan jangan risau, saya ada di sini menemani awak.',
```

**Halaman surat:** surat dipecahkan kepada halaman **secara automatik** — setiap
**4 perenggan** menjadi satu halaman. Jadi menambah perenggan ke-5 akan mencipta
halaman ke-2 dengan sendirinya. Tiada apa-apa lagi perlu diubah.

**Halaman buku** (Perpustakaan, `books` dalam bahagian 4): setiap teks dalam `pages`
ialah satu halaman. Tambah satu baris untuk halaman baharu:

```ts
      pages: [
        'Halaman satu…',
        'Halaman dua…',
        'Halaman tiga baharu.',      // ← halaman baharu
      ],
```

**Baris dialog baharu:** tambah `['him', 'Ayat baharu.'],` dalam babak yang dikehendaki.

## 9. Contoh sebelum dan selepas

**Contoh A — ubah tajuk surat cinta**

Sebelum:
```ts
    title: 'Untuk wanita kesayangan saya',
```
Selepas:
```ts
    title: 'Untuk Sarah, wanita kesayangan saya',
```

**Contoh B — tambah balasan offline baharu bila Sarah kata "rindu"**

Sebelum:
```ts
        { match: ['rindu', 'miss'], replies: ['Saya pun rindu awak. Padahal awak ada depan mata.', 'Rindu tu tanda sayang. Jadi saya sayang awak banyak gila.'] },
```
Selepas:
```ts
        { match: ['rindu', 'miss'], replies: ['Saya pun rindu awak. Padahal awak ada depan mata.', 'Rindu tu tanda sayang. Jadi saya sayang awak banyak gila.', 'Rindu? Sini, saya teman awak lama-lama.'] },
```

**Contoh C — ayat dengan apostrophe**

Salah ❌ (game tidak akan dibina):
```ts
    line1: 'It's your day',
```
Betul ✅:
```ts
    line1: "It's your day",
```

## 10. Menyimpan, build dan deploy

1. **Simpan fail:** **Ctrl+S**.
2. **Lihat hasil di komputer:** buka Terminal dalam VS Code (**Ctrl+`**) dan taip:
   ```bash
   npm run dev
   ```
   Buka <http://localhost:5173> dalam pelayar. Halaman dimuat semula sendiri setiap kali
   anda simpan. Tekan **Ctrl+C** dalam Terminal untuk berhenti.
3. **Terima perubahan teks anda** (wajib selepas mengubah teks sedia ada):
   ```bash
   npm run content:accept
   ```
   Ujian keselamatan membandingkan teks game dengan "snapshot" supaya tiada ayat
   hilang tanpa sengaja. Arahan ini menjadikan teks baharu anda sebagai snapshot
   rasmi, kemudian menjalankan semua ujian. Jika ada ujian gagal, baca mesejnya —
   biasanya ia menunjukkan tanda petik atau koma yang tertinggal, atau perkataan
   "aku/kau/kamu".
4. **Build (semakan akhir):**
   ```bash
   npm run build
   ```
   Jika ada ralat merah, biasanya ia menunjukkan nombor baris yang ada salah taip.
5. **Deploy ke GitHub Pages:** simpan perubahan ke Git dan push ke cabang `main`:
   ```bash
   git add -A
   git commit -m "Kemas kini kandungan peribadi"
   git push
   ```
   GitHub Actions akan menguji, membina dan menerbitkan game dalam beberapa minit
   (lihat tab **Actions** dalam repo). *(Sambungan Git ke repo perlu disediakan dahulu.)*
6. **Jika anda mengubah persona AI** (`proxy/src/persona.ts`): `npm run proxy:bundle`,
   kemudian tampal `proxy/worker-dashboard.js` ke Cloudflare Dashboard dan tekan
   **Deploy** (langkah penuh dalam `proxy/README.md`).

### Jika sesuatu tidak kena

- **Skrin putih / ralat selepas edit:** semak tanda petik, koma dan `+` pada baris yang
  baru diubah. Batalkan perubahan terakhir dengan **Ctrl+Z** dan cuba lagi.
- **Teks muncul sebagai `{count}` atau `{HER_NAME}`:** token telah tersalah eja — salin semula
  dari contoh asal.
- **Sejarah sembang Fareed:** disimpan dalam pelayar Sarah sahaja dan boleh dipadam dari
  butang "Padam perbualan" dalam ruang sembang. Ia berasingan daripada kemajuan game.
