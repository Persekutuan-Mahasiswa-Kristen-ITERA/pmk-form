# PROMPT: Perombakan Total UI/UX PMK Form (Responsif Mobile + Halaman 404)

Peran: senior front-end engineer + UI/UX designer + code reviewer untuk codebase production PMK Form
(Next.js App Router, TypeScript strict, Tailwind + shadcn/ui, Supabase, react-hook-form + zod, @dnd-kit).

Prioritas: Correctness > Security > Data integrity > Maintainability > UX > Performance > Simplicity.
Bahasa komunikasi denganku: Indonesia (istilah teknis boleh Inggris).

---

## 0. TUJUAN

Fase pemeliharaan dan fitur (Fase 1 sampai 7) sudah selesai. Sekarang tampilan harus dirombak total karena:
- terasa acak-acakan dan tidak konsisten antar halaman,
- **tidak responsif untuk pengguna mobile (Android dan iOS)**; mayoritas pendaftar membuka form dari HP,
- belum ada halaman 404 yang layak.

Referensi visual: **satu halaman saja, Dashboard Admin** (deskripsi lengkap di bagian 3, gambar di
`docs/design/reference-dashboard.png`). Semua halaman lain harus **menyesuaikan** bahasa desain yang sama.

---

## 1. BATASAN MUTLAK (tidak boleh dilanggar)

1. **Warna, font, dan logo TIDAK BOLEH berubah.** Ambil semuanya dari kode yang sudah ada
   (`tailwind.config`, `globals.css`/CSS variables, `next/font`, komponen `<PMKLogo />`). Jangan menebak warna dari
   screenshot. Jika warna di screenshot sedikit berbeda dari token yang ada, **token yang ada yang menang**; laporkan
   perbedaannya. Jangan menambah warna baru; jika butuh varian (mis. latar status), turunkan dari token yang ada
   dan catat di `docs/DESIGN_TOKENS.md`.
2. **Perubahan bersifat presentasional.** Server actions, validasi zod, otorisasi (`requireAdmin()` dll.), RLS,
   schema DB, dan alur submit tidak boleh berubah. Jika sebuah tampilan butuh data/logika baru (mis. statistik),
   pisahkan di commit tersendiri dan jelaskan di laporan. Tidak ada migration kecuali kuminta; jika menurutmu perlu,
   tulis sebagai usulan (file saja, jangan dijalankan).
3. **Jangan membuat tombol yang tidak berfungsi.** Referensi menampilkan fitur (Duplikasi, Hapus, Tutup/Buka, Audit Log,
   Admin) yang mungkin belum semuanya ada. Verifikasi di kode. Fitur yang belum ada: **sembunyikan, jangan dipalsukan,
   jangan diimplementasikan diam-diam**; tanyakan di Checkpoint U0.
4. Tidak ada dependency baru kecuali alasannya kuat dan kamu sudah membandingkan opsi ringan (mis. gunakan
   shadcn/ui, `lucide-react`, dan Tailwind yang sudah ada). Tidak ada tambahan font/skrip eksternal.
5. Server Components secara default. Client Component hanya untuk interaktivitas nyata (toggle, dialog, drawer, chart interaktif).
6. Aksi destruktif (Hapus, dll.) wajib memakai dialog konfirmasi dan tetap dilindungi otorisasi server yang sudah ada.
   Jangan membocorkan informasi lewat UI (mis. halaman 404 tidak boleh membedakan "slug tidak ada" vs "form ditutup"
   secara berlebihan; ikuti perilaku RLS yang sekarang).
7. Dark mode tidak diminta; jangan ditambahkan.
8. Git: satu branch per fase (`feat/ui-*`), satu commit per langkah logis, jangan commit ke main, tanpa operasi Git destruktif.
   Perbarui `docs/PROGRESS.md` (bagian "UI Overhaul") di setiap commit penting.

---

## 2. PROTOKOL KERJA (sama dengan docs/prompts/MASTER.md)

- Aku membalas `lanjut`, `lanjut, tapi <perubahan>`, `revisi: <catatan>`, atau `tahan`.
- Kerjakan semua sub-langkah satu fase tanpa berhenti; berhenti hanya di checkpoint, atau jika ada temuan keamanan,
  ambiguitas yang berisiko salah implementasi, atau verifikasi gagal yang tak bisa diperbaiki kecil.
- Setiap keputusan disajikan dengan **rekomendasi default** dan akibatnya jika aku hanya membalas `lanjut`.
- Di setiap checkpoint tulis "Langkah manual untukku" (mis. cek di HP, DevTools, perangkat nyata).
- Setelah setiap fase: `npx tsc --noEmit`, `npx eslint .`, `next build`. Laporkan jujur. Jangan klaim beres tanpa
  verifikasi; sebut apa yang tidak bisa diverifikasi.
- **Verifikasi visual:** jika environment-mu punya browser headless/tool screenshot, ambil screenshot di viewport
  360, 390, 768, 1024, 1440 px dan sertakan ringkasannya. Jika tidak ada, nyatakan jelas bahwa verifikasi visual
  tidak bisa kamu lakukan dan berikan checklist manual untukku. Jangan menambah dependency permanen hanya untuk ini.

---

## 3. SPESIFIKASI REFERENSI: DASHBOARD ADMIN (deskripsi screenshot)

Semua angka dan nama formulir di screenshot adalah **data contoh**. Pakai data nyata dari DB, jangan hardcode.
Teks (copy) berbahasa Indonesia di bawah ini dipakai apa adanya sebagai acuan.
Ukuran px di bawah hanya perkiraan proporsi; yang wajib dijaga adalah hierarki, ritme spasi, dan rasa visualnya.

### 3.A Kerangka halaman
- Latar halaman: krem hangat (off-white kehangatan), bukan putih murni. Kartu-kartu berlatar putih di atasnya.
- Konten berada di tengah dengan lebar maksimum (perkiraan `max-w-6xl`), padding horizontal konsisten.
- Kartu: sudut membulat (perkiraan 12px), border tipis 1px berwarna krem/cokelat muda, bayangan sangat halus atau tanpa bayangan.
- Jarak vertikal antar blok sekitar 24px; di dalam kartu padding sekitar 20-24px.
- Hierarki tipografi: **judul halaman dan judul kartu memakai serif display** (tampak seperti Playfair Display;
  gunakan font yang sudah dipakai di kode), **angka statistik besar juga serif**; semua teks lain sans-serif.
  Label kecil berhuruf kapital dengan letter-spacing, berwarna cokelat (accent) tua.

### 3.B Navbar atas
- Latar putih, border bawah tipis, tinggi sekitar 56px, sticky di atas.
- Kiri: logo bulat PMK (`<PMKLogo />`), di sampingnya dua baris teks: **"PMK Admin"** (tebal) dan
  **"Portal Formulir & Pelayanan"** (kecil, abu-cokelat).
- Tengah-kiri (setelah logo): menu dengan ikon + label: **Dashboard** (ikon rumah), **Formulir** (ikon dokumen),
  **Admin** (ikon pengguna), **Audit Log** (ikon aktivitas). Ikon bergaya garis tipis (lucide).
  Referensi tidak menampilkan state aktif dengan jelas; **tambahkan state aktif yang jelas** (teks warna accent +
  penanda garis bawah/latar halus) memakai token yang ada.
- Kanan: nama pengguna **"Panitia PMK"** (tebal) dengan role **"admin"** di bawahnya (kecil, warna accent),
  lalu tombol **"Keluar"** bergaya outline dengan ikon keluar.

### 3.C Header halaman
- Kiri: judul **"Dashboard"** (serif, besar) dan subjudul abu-cokelat:
  "Ringkasan formulir dan pelayanan yang sedang berjalan. Perubahan pada halaman ini tercatat di audit log."
  (lebar teks dibatasi sekitar 60 karakter per baris).
- Kanan: tombol utama **"+ Buat formulir"**, terisi warna accent (cokelat kemerahan/rust) dengan teks putih dan ikon plus.

### 3.D Empat kartu statistik (satu baris, lebar sama)
Pola tiap kartu: label kapital kecil, angka besar serif, keterangan kecil.
1. **FORMULIR AKTIF** / `12` / "dari 16 formulir dibuat". Aktif = hasil `isFormActive()` (definisi tunggal dari Fase 2).
   "dibuat" = total formulir.
2. **RESPONS MASUK** / `348` / "↑ +27 bulan ini" (teks hijau/teal dengan panah naik). 348 = total respons;
   +27 = respons pada bulan kalender berjalan, **dihitung dalam zona waktu Asia/Jakarta (WIB)**.
   Jika 0 atau turun, tampilkan netral (tanpa panah hijau).
3. **SEGERA DITUTUP** / `2` (angka berwarna merah) / "tenggat dalam 7 hari". **Kartu ini bergaya peringatan**:
   latar dan border merah muda. Definisi: formulir aktif yang `close_date`-nya dalam 7 hari ke depan.
   Jika 0, kartu tampil netral (gaya sama dengan kartu lain).
4. **KATEGORI DIPAKAI** / `5` / "Recruitment, Event, Survei, Presensi, Umum" (daftar kategori distinct yang dipakai;
   batasi ke 2 baris dengan elipsis di layar kecil).

### 3.E Kartu grafik "Respons per periode"
- Judul serif **"Respons per periode"**; subjudul "Menampilkan 6 bulan terakhir · total 348 respons".
- Kanan atas: segmented control dua opsi **"6 bulan"** (aktif: pil putih dengan bayangan halus) dan **"12 bulan"**,
  di atas trek krem.
- Area grafik besar (tinggi sekitar 250px). Legenda di bawah kiri: titik koral/oranye-merah = **"Respons per bulan"**,
  titik teal/hijau = **"Formulir dibuka"**.
- Interpretasi: batang = jumlah respons per bulan; garis atau penanda = jumlah formulir yang dibuka per bulan
  (berdasarkan `open_date`, fallback `created_at`). Bulan memakai zona WIB dan label bahasa Indonesia (Jan, Feb, dst.).
- **CACAT PADA REFERENSI: area grafik di screenshot KOSONG** (tidak ter-render). Cari akar masalahnya
  (data kosong, tinggi container 0, masalah SSR/hidrasi, dsb.) dan perbaiki. Wajib ada: skeleton saat memuat,
  empty state yang jelas ("Belum ada respons pada periode ini") bila data kosong, tooltip saat hover/tap,
  dan ringkasan teks alternatif untuk aksesibilitas (mis. `aria-label`/tabel tersembunyi).
- Agregasi di server: ambil hanya kolom `created_at` dalam rentang periode (jangan menarik `answers`), agregasi di server.
  Gunakan library chart yang sudah ada di proyek; jika belum ada, gunakan SVG/CSS ringan tanpa dependency baru.
  Usulkan RPC SQL sebagai file migration (tidak dijalankan) hanya jika volume data menuntut.

### 3.F Banner peringatan
- Kartu lebar penuh, latar merah muda, border merah muda tua, ikon lingkaran tanda seru di kiri.
- Judul serif tebal: **"2 formulir akan segera ditutup"**; isi:
  "Pendaftaran Panitia Natal 2026 ditutup 2 hari lagi dan Survei Kepuasan Pelayanan ditutup 5 hari lagi.
  Perpanjang tenggat dari halaman formulir bila masih dibutuhkan."
- Hanya tampil jika ada formulir yang segera ditutup. Sebut paling banyak 2-3 nama, sisanya "dan N lainnya".
  Nama formulir harus di-escape (jangan render HTML mentah). Nama formulir bisa berupa tautan ke halaman formulir.

### 3.G Kartu tabel "Formulir terbaru"
- Judul serif **"Formulir terbaru"**; subjudul "Aksi cepat langsung berlaku pada baris terkait."
  Kanan atas: tautan bergaris bawah warna accent **"Lihat semua formulir"** menuju `/admin/forms`.
- Baris header tabel: latar krem, teks kapital kecil berwarna cokelat: **FORMULIR | KATEGORI | STATUS | RESPONS | AKSI**.
- Lima baris terbaru (urut `updated_at` menurun). Setiap baris:
  - **Penanda vertikal di kiri** (bilah tipis bergradien accent), dekoratif.
  - **Judul formulir** tebal (tautan ke `/admin/forms/[id]`), di bawahnya meta kecil:
    "Recruitment · diperbarui 12 Nov 2026" (format tanggal `d MMM yyyy`, locale `id-ID`, zona WIB).
  - **Badge kategori** berbentuk pil terisi dengan warna per kategori: Recruitment (cokelat/rust), Event (oranye),
    Presensi (hijau), Survei (biru), Umum (krem dengan teks gelap). **Pakai warna kategori yang sudah ada di kode**
    (mis. di `FormCard`/helper kategori); jangan menciptakan ulang.
  - **Badge status** berbentuk pil dengan titik di depan: **"Segera ditutup"** (merah muda, titik merah),
    **"Dibuka"** (hijau mint, titik hijau), **"Ditutup"** (krem abu, titik abu). Tambahkan status
    **"Belum dibuka"** bila sekarang < `open_date` (turunkan gaya dari token yang ada).
    Status tidak boleh hanya berbasis warna; teks wajib ada.
  - **Respons**: angka tebal, ditautkan ke `/admin/forms/[id]/responses`.
  - **Aksi**: tombol kecil outline dengan ikon+label: **"Tutup"** (atau **"Buka"** bila formulir tertutup),
    **"Duplikasi"** (ikon salin), **"Hapus"** (ikon tempat sampah; gaya destruktif halus).
    Klik tombol aksi tidak boleh memicu navigasi baris.
- Di screenshot kolom STATUS/RESPONS/AKSI sedikit tidak sejajar dan tombol aksi terlalu rapat; rapikan:
  kolom dengan lebar tetap/proporsional, rata kiri untuk teks, rata kanan untuk aksi, jarak antar tombol cukup.

### 3.H Hal yang harus diverifikasi dari referensi
- Apakah **Duplikasi**, **Hapus**, **Tutup/Buka**, **Audit Log**, **Admin** sudah ada fungsinya di kode?
  Yang belum ada: sesuai batasan 3 di atas.
- Aturan Hapus dari Fase 4C: form berisi respons tidak boleh di-hard-delete. UI harus mencerminkannya
  (tombol dinonaktifkan dengan tooltip/penjelasan, atau alur soft delete bila sudah ada).

---

## 4. ATURAN RESPONSIF MOBILE (Android + iOS)

### Breakpoint dan strategi
Mobile-first. Uji minimal di lebar **360, 390, 768, 1024, 1440**. Tidak boleh ada scroll horizontal pada halaman di
360px (kecuali kontainer yang memang sengaja bisa digeser, mis. tabel respons lebar, dengan indikator jelas).

### Pola per komponen (dashboard sebagai contoh, berlaku umum)
- **Navbar:** di bawah `lg`, tampilkan bar ringkas (logo + "PMK Admin" + tombol menu). Menu (Dashboard, Formulir,
  Admin, Audit Log), identitas pengguna, dan "Keluar" masuk ke **drawer/sheet** (shadcn `Sheet`). Item menu tinggi
  minimal 44px. Rekomendasi default: drawer. (Bottom tab bar adalah alternatif; pilih satu dan jelaskan alasannya.)
- **Header halaman:** judul dan tombol utama bertumpuk; tombol "+ Buat formulir" lebar penuh di mobile.
- **Kartu statistik:** grid 2 kolom di mobile dan tablet, 4 kolom mulai `lg`. Kartu peringatan tetap menonjol.
- **Grafik:** lebar penuh, tinggi sekitar 200px di mobile, label sumbu X dijarangkan, segmented control tetap
  terjangkau jempol, legenda boleh membungkus. Tooltip bekerja dengan tap.
- **Banner peringatan:** ikon di atas/kiri, teks membungkus, lebar penuh.
- **Tabel menjadi daftar kartu** di bawah `md`: setiap formulir = satu kartu (judul 2 baris maksimum dengan
  elipsis, baris badge kategori+status, jumlah respons, tombol aksi utama Tutup/Buka, dan menu overflow "⋯" untuk
  Duplikasi dan Hapus). Penanda vertikal kiri menjadi border kiri kartu. Jangan menjejalkan tiga tombol teks dalam satu baris.
- **Target sentuh minimal 44x44px**, jarak antar target cukup, tanpa hover-only interaction.

### Spesifik iOS (Safari)
- `viewport-fit=cover` melalui `export const viewport` Next.js; pakai `env(safe-area-inset-*)` untuk bar tetap
  (navbar, bar aksi bawah).
- **Font input minimal 16px** (kalau tidak, Safari memperbesar halaman saat fokus).
- Gunakan `100dvh`/`min-h-dvh`, bukan `100vh`, untuk tata letak satu layar (login, 404).
- Hindari `position: fixed` yang bertabrakan dengan keyboard; bar aksi bawah harus tetap aman saat keyboard muncul.
- Perhatikan gaya bawaan `select`, `input[type=date]`, `appearance`, dan `-webkit-tap-highlight-color`.

### Spesifik Android (Chrome)
- Address bar yang menyusut/membesar: gunakan `dvh`. Uji layar 360px.
- Keyboard virtual tidak boleh menutupi field aktif atau tombol kirim.

### Umum
- `theme-color` meta selaras dengan warna brand yang ada. Teks minimal 14px untuk isi, 12px untuk label kecil.
- Gambar via `next/image` dengan `sizes` yang tepat; tidak ada layout shift saat logo dimuat.
- Hormati `prefers-reduced-motion`. Animasi seperlunya.

---

## 5. SISTEM DESAIN BERSAMA (agar halaman lain menyesuaikan)

Bangun komponen bersama (reuse yang sudah ada seperti `PMKLogo`, `FilterChip`, `StatCard`, `FORM_CATEGORIES`,
dan komponen shadcn; hindari duplikasi):

`AdminShell` (navbar + drawer), `PublicShell` (header ringan + footer), `PageHeader` (judul serif + subjudul + aksi),
`SectionCard` (judul serif + subjudul + aksi kanan), `StatCard` (varian normal/peringatan), `CategoryBadge`,
`StatusBadge`, `ResponsiveTable` (tabel di desktop, daftar kartu di mobile), `EmptyState`, `Skeleton` pages
(`loading.tsx`), `ConfirmDialog`, `SegmentedControl`, toolbar pencarian+filter.

Aturan konsistensi: tombol utama = terisi accent; sekunder = outline; destruktif = outline merah halus;
status/kategori selalu lewat `StatusBadge`/`CategoryBadge`; tanggal selalu lewat satu helper format (id-ID, WIB);
setiap daftar punya loading, kosong, dan error state; pesan error aman (tanpa detail DB/stack).

### Kebutuhan per halaman

**Admin**
- `/admin/login`: kartu di tengah, `min-h-dvh`, logo + judul serif, tombol login (Google bila Fase 5 aktif; sertakan
  jalur lama bila masih ada), pesan error/akses ditolak yang aman, aman untuk safe-area.
- `/admin/dashboard`: sesuai bagian 3 dan 4.
- `/admin/forms`: header "Formulir" + "Buat formulir"; toolbar pencarian + `FilterChip` kategori + filter status;
  daftar memakai pola baris/kartu yang sama dengan dashboard; empty state; paginasi atau "muat lebih banyak" bila banyak.
- `/admin/forms/new` dan `/admin/forms/[id]` (builder): desktop dua panel (daftar/kanvas field + panel pengaturan);
  mobile: tab atau tumpukan, editor field dalam `Sheet`/drawer, **bar aksi bawah sticky** (Simpan/Pratinjau) yang aman
  safe-area. dnd-kit: tambahkan `TouchSensor` (activation delay/tolerance) dan `KeyboardSensor`, plus tombol
  naik/turun sebagai alternatif aksesibel. Pengaturan dikelompokkan (accordion). Peringatan perubahan belum disimpan.
  Jangan mengubah struktur data form/field.
- `/admin/forms/[id]/responses`: ringkasan di atas, pencarian/filter, tabel dengan kolom pertama sticky dan scroll
  horizontal di desktop; di mobile daftar kartu menampilkan identitas utama (mis. nama/NIM) dan **drawer detail**
  untuk semua jawaban (tetap memakai `resolveAnswer`). Tombol ekspor (CSV/ZIP) dan aksi lain dikelompokkan dalam
  dropdown di mobile. Hapus respons memakai `ConfirmDialog`. Tautan lampiran jelas.
- `/admin/users` dan `/admin/audit-log` (bila ada): pola daftar/kartu yang sama, badge role/status, aksi via menu,
  konfirmasi untuk aksi destruktif, filter dan paginasi untuk audit log.

**Publik** (prioritas tinggi karena mayoritas dibuka dari HP)
- `/` (landing): hero ringkas, statistik, `FilterChip`, grid kartu formulir (1 kolom mobile, 2 tablet, 3 desktop).
  **Empty state yang bagus** ketika tidak ada formulir terbuka (saat ini semua formulir produksi tertutup):
  teks ramah, penjelasan, dan tautan yang relevan (mis. ke `/hasil` bila berlaku).
- `/form/[slug]` (**halaman terpenting untuk mobile**): satu kolom, label di atas input, input 16px+, target sentuh besar,
  radio/checkbox dengan area klik penuh baris, `select` native di mobile, indikator progres bila `show_progress`,
  error inline + scroll ke error pertama, upload file dengan petunjuk tipe/ukuran, status unggah dan error jelas,
  tombol kirim menonaktifkan diri saat proses (cegah double submit), pesan rate limit/penutupan yang ramah, tombol kirim
  atau bar aksi bawah yang aman safe-area dan keyboard.
- `/form/[slug]/success`: konfirmasi jelas, `thank_you_message`, tombol link grup WhatsApp yang menonjol bila ada,
  tombol kembali ke beranda. Pastikan `redirect_url` tetap dihormati.
- `/hasil` (Cek Hasil): form NIM + email yang nyaman di HP, kartu hasil dengan state jelas (ditemukan/tidak ditemukan/
  error), jangan menampilkan data lebih dari yang sudah dikembalikan API sekarang.

---

## 6. HALAMAN 404, ERROR, DAN STATE LAIN

Buat dan selaraskan dengan brand (logo, serif untuk judul, latar krem, tombol accent), berlayar penuh dengan `min-h-dvh`,
responsif, tanpa membocorkan detail teknis:

1. **`app/not-found.tsx` (404 global):** logo, angka/ilustrasi sederhana (tanpa aset baru yang berat; SVG/CSS saja),
   judul serif "Halaman tidak ditemukan", teks ramah dalam bahasa Indonesia, tombol utama "Kembali ke beranda",
   tombol sekunder "Lihat formulir" (atau "Ke dashboard" bila pengguna admin yang sedang login; tentukan di server
   tanpa membocorkan informasi). Metadata `noindex`.
2. **Not-found khusus `/form/[slug]`:** pesan "Formulir tidak ditemukan atau sudah ditutup" yang aman
   (perilaku RLS saat ini mengembalikan null untuk form tertutup bagi non-admin; jangan membedakan keduanya secara
   terbuka), dengan tautan ke beranda.
3. **`app/error.tsx` dan `app/global-error.tsx`:** pesan aman, tombol "Coba lagi" (`reset`), tombol ke beranda,
   tanpa stack trace atau pesan error mentah. Jangan log PII.
4. **Halaman 403 "Akses Ditolak"** (yang sudah ada di layout admin): samakan gayanya, tetap ada tombol "Keluar".
5. **`loading.tsx`** berupa skeleton untuk rute admin dan publik utama; **empty state** konsisten untuk daftar kosong.
6. Rute `/admin/*` tanpa login tetap diarahkan ke login oleh `proxy.ts` (jangan diubah); 404 tidak boleh membuka
   atau mengungkap keberadaan rute admin kepada pengguna tak terautentikasi.

---

## 7. FASE KERJA

### U0: Discovery (read-only, tanpa mengubah kode)
- Inventarisasi semua halaman/komponen, komponen shadcn yang dipakai, library chart (jika ada), dan helper kategori/status.
- Ekstrak token yang ada (warna, font, radius, bayangan, spacing) ke `docs/DESIGN_TOKENS.md`.
- Audit masalah responsif per halaman (daftar masalah + tingkat keparahan) dan penyebab grafik kosong.
- Petakan elemen referensi ke komponen/data; daftar fitur di referensi yang belum ada di kode.
- Usulkan arsitektur komponen dan rencana tata letak. Tampilkan sebagai rencana singkat (bukan kode).
- **Keputusan yang diajukan (dengan default):**
  (a) navigasi mobile: drawer (default) vs bottom tab bar;
  (b) fitur referensi yang belum ada (mis. Duplikasi): sembunyikan (default) vs implementasi sebagai pekerjaan terpisah;
  (c) kategori pada kartu "Kategori dipakai": dari semua formulir (default) vs hanya yang aktif;
  (d) ukuran pekerjaan: lanjutkan semua halaman (default) vs prioritaskan publik dulu.
🛑 CHECKPOINT U0.

### U1: Fondasi desain (branch `feat/ui-foundation`)
- Rapikan token (tanpa mengubah warna/font/logo), skala tipografi, spacing, viewport/safe-area, `theme-color`.
- Bangun komponen bersama (bagian 5), `AdminShell` + `PublicShell` responsif, halaman 404/error/403/loading (bagian 6).
- Tes unit untuk helper murni (format tanggal WIB, status form, hitung statistik) memakai pola tes yang sudah ada.
🛑 CHECKPOINT U1.

### U2: Dashboard + shell admin (branch `feat/ui-admin-dashboard`)
- Implementasi dashboard sesuai bagian 3 dan 4, termasuk perbaikan grafik kosong, data nyata, dan semua state.
- Pastikan semua aksi memakai server action yang sudah ada dan dialog konfirmasi.
🛑 CHECKPOINT U2.

### U3: Halaman publik mobile-first (branch `feat/ui-public`)
- `/form/[slug]` dulu, lalu success, landing, dan `/hasil`.
🛑 CHECKPOINT U3.

### U4: Halaman admin lainnya (branch `feat/ui-admin-pages`)
- login, daftar formulir, builder, responses, users, audit log (yang ada).
🛑 CHECKPOINT U4.

### U5: QA dan polish (branch `chore/ui-qa`)
- Audit aksesibilitas (fokus terlihat, urutan tab, label ikon, kontras, `aria-live` untuk toast), performa (ukuran bundle
  client, layout shift, gambar), konsistensi lintas halaman, pembersihan komponen lama yang tak terpakai
  (grep dulu), `docs/UI_GUIDE.md` (token, komponen, pola responsif, cara menambah halaman baru), perbarui README.
🛑 CHECKPOINT U5 (final).

---

## 8. KRITERIA PENERIMAAN (diperiksa di setiap checkpoint relevan)

- [ ] Warna, font, logo identik dengan sebelumnya (tidak ada token baru tanpa catatan di `DESIGN_TOKENS.md`).
- [ ] Tidak ada scroll horizontal di 360px dan 390px pada semua halaman (kecuali kontainer geser yang disengaja).
- [ ] Semua target sentuh interaktif minimal 44x44px di mobile.
- [ ] Input form berfont minimal 16px; tidak ada zoom otomatis di iOS saat fokus.
- [ ] Tata letak satu layar memakai `dvh`; bar tetap memakai safe-area; keyboard tidak menutupi field/tombol aktif.
- [ ] Dashboard sesuai deskripsi bagian 3 di desktop, dan sesuai pola bagian 4 di mobile; grafik ter-render dengan
      data nyata dan punya skeleton, empty state, dan alternatif aksesibel.
- [ ] Tidak ada tombol palsu; aksi destruktif punya konfirmasi; otorisasi server tidak berubah.
- [ ] 404 global, 404 form, error, 403, loading, dan empty state ada dan selaras brand, tanpa kebocoran informasi teknis.
- [ ] Semua halaman memiliki state loading, kosong, dan error.
- [ ] `tsc`, `eslint`, `next build` bersih; tidak ada secret/PII baru di log atau bundle client.
- [ ] Tidak ada dependency baru tanpa alasan tercatat.

---

## 9. FORMAT LAPORAN CHECKPOINT (tetap)

1. Ringkasan (file diubah/dibuat/dihapus, alasan, hash commit)
2. Verifikasi (tsc, eslint, build, tes unit, verifikasi visual per viewport, atau pernyataan jujur bila tak bisa)
3. Tidak bisa diverifikasi
4. Risiko/regresi dan rencana rollback
5. Temuan baru (keamanan/data integrity/aksesibilitas)
6. Perubahan yang terlihat user (before/after singkat)
7. Keputusan yang menunggu aku (pertanyaan, opsi, rekomendasi default, akibat jika `lanjut`)
8. Langkah manual untukku (uji di HP nyata iOS/Android, DevTools, daftar halaman yang harus kubuka)
9. `docs/PROGRESS.md` sudah diperbarui (ya/tidak)
10. Penutup: `Balas "lanjut" untuk mulai <fase berikutnya>.`

---

## 10. MULAI SEKARANG

Baca `docs/PROGRESS.md`, `docs/AUTHORIZATION_MATRIX.md`, `docs/prompts/MASTER.md`, dan `git log`.
Pastikan working tree bersih dan `main` terbaru. Lalu jalankan **FASE U0 saja** (read-only) dan berhenti di
CHECKPOINT U0. Jangan ubah kode sebelum aku membalas.
