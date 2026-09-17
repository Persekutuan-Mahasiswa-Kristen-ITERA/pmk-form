# Prompt: Fitur Halaman Pengumuman Hasil Seleksi — form.pmkitera.web.id

> Cara pakai: buka coding assistant/agent yang biasa kamu pakai untuk mengerjakan repo `form.pmkitera.web.id`, lalu tempel (paste) seluruh isi di bawah ini sebagai prompt awal. Lampirkan juga kedua file datanya (CSV pendaftar & Excel hasil seleksi) ke chat/agent tersebut. Setelah itu tinggal balas "lanjut"/"next" di setiap fase.

---

## Peran & Konteks

Kamu akan menambahkan **fitur baru** ke website `form.pmkitera.web.id` yang sudah berjalan. Website ini sebelumnya dipakai untuk form pendaftaran "Open Recruitment Staff Internship PMK ITERA 2026", dan pendaftarannya sudah ditutup. Sekarang aku mau menambahkan **halaman baru** (bukan mengganti/menimpa halaman form pendaftaran yang sudah ada) khusus untuk pengumuman hasil seleksi, di route/path terpisah — misalnya `/hasil` atau `/pengumuman` (sesuaikan dengan konvensi routing project ini).

## Data yang Aku Lampirkan

1. **Data pendaftar** — kemungkinan besar sudah tersimpan di database yang sama dengan yang dipakai form ini (karena berasal dari form yang sama). File referensi: `Data_Pendaftar_-_OPEN_RECRUITMENT_STAFF_INTERNSHIP_PMK_ITERA_2026.csv`. Kolomnya: No, Nama, NIM, Email, Tanggal Daftar, Angkatan, No. WhatsApp, Program Studi, Pilihan Divisi 1, Pilihan Divisi 2, Alasan Memilih Divisi 1 & 2, Kesaksian Iman (opsional), Bersedia Dipindahkan Ke Divisi Lain, Pokok Doa & Motivasi. Total 158 baris.
2. **Data hasil seleksi (yang lolos)** dalam Excel: `PENGUMUMAN_STAFF_INTERNSHIP_PMK_2026.xlsx`. Formatnya masih manual: dikelompokkan per **Departemen** lalu per **Divisi**, dan tiap kelompok punya mini-tabel sendiri dengan kolom No, Nama, Nim, Prodi yang posisinya bersebelahan secara horizontal di satu sheet (bukan tabel panjang ke bawah).
   ⚠️ Catatan kualitas data: ada beberapa baris dengan NIM kosong, dan setidaknya satu nama yang muncul di dua divisi berbeda dengan NIM yang berbeda pula (kemungkinan salah input). **Jangan menebak/mengoreksi ini sendiri** — tampilkan semua baris yang ambigu ke aku dan biarkan aku yang putuskan sebelum data itu diimport.

## Yang Aku Mau

Halaman publik tempat pendaftar bisa **cek status kelulusan masing-masing secara mandiri**, dengan memasukkan NIM (bisa ditambah Nama sebagai validasi ganda). **Bukan** halaman yang menampilkan daftar semua nama sekaligus ke publik — supaya lebih privat dan tidak riweuh.

Logika hasil yang ditampilkan:
- NIM tidak ditemukan sama sekali di data pendaftar → "NIM tidak ditemukan, pastikan NIM yang dimasukkan sudah benar."
- NIM ditemukan di data pendaftar tapi **tidak** ada di data lolos → pesan sopan & menyemangati bahwa belum lolos tahap ini.
- NIM ditemukan di data lolos → "Selamat! Kamu LOLOS", tampilkan juga Departemen dan Divisi penempatannya.

Desain halaman harus konsisten dengan tampilan/branding form.pmkitera.web.id yang sudah ada (warna, font, komponen) — pelajari dulu desain yang ada sebelum membuat apa pun yang baru.

## Cara Kerja: Jalankan Bertahap, Jangan Sekaligus

Kerjakan fase-fase di bawah **satu per satu**. Setiap selesai satu fase, **berhenti**, tunjukkan ringkasan singkat apa yang kamu temukan/kerjakan, lalu tunggu aku balas "lanjut" sebelum masuk ke fase berikutnya. Jangan loncat fase.

### Fase 0 — Eksplorasi
- Pelajari struktur project ini: framework yang dipakai, struktur folder, cara koneksi database, ORM/query builder, dan bagaimana halaman form pendaftaran yang sudah ada disusun (routing, komponen, styling).
- Cek apakah tabel pendaftar di database sudah cocok dengan struktur CSV yang aku lampirkan.
- Laporkan temuan sebelum lanjut.

### Fase 1 — Rancangan Skema Data
- Usulkan skema tabel baru untuk hasil seleksi (contoh: `hasil_seleksi` — nim, nama, departemen, divisi, status, created_at), **tanpa langsung dieksekusi**.
- Tunjukkan rencana pencocokan NIM pendaftar ↔ NIM hasil seleksi.
- Tunggu persetujuanku.

### Fase 2 — Import Data Hasil Seleksi
- Buat script sekali-pakai untuk membaca `PENGUMUMAN_STAFF_INTERNSHIP_PMK_2026.xlsx`, parse struktur per-Departemen/per-Divisi menjadi baris-baris rapi, lalu siap dimasukkan ke tabel `hasil_seleksi`.
- Tampilkan dulu ke aku semua baris dengan NIM kosong/nama ambigu sebelum benar-benar diproses ke database.

### Fase 3 — Backend / API
- Buat endpoint baru (misalnya `POST /api/cek-hasil`) yang menerima NIM (+opsional nama) dan mengembalikan status sesuai logika di atas.
- Tambahkan proteksi dasar (rate limit sederhana) supaya endpoint ini tidak dipakai untuk scraping semua data sekaligus.

### Fase 4 — Frontend / Halaman Baru
- Buat halaman baru di route terpisah, berisi form input NIM + tombol cek + area hasil.
- Gunakan ulang komponen/style yang sudah ada di form.pmkitera.web.id agar konsisten.
- Pastikan responsive di HP (mayoritas pendaftar kemungkinan buka dari HP).

### Fase 5 — Uji Coba
- Tunjukkan hasil test dengan beberapa NIM contoh: satu yang lolos, satu yang terdaftar tapi tidak lolos, satu yang tidak terdaftar sama sekali — sebelum menyatakan selesai.

### Fase 6 — Ringkasan Akhir (STOP di sini)
- Rangkum semua file yang dibuat/diubah.
- **JANGAN menjalankan `git add`, `git commit`, atau `git push` ke GitHub/remote apa pun.** Biarkan semua perubahan tetap lokal supaya aku bisa review manual dulu sebelum di-push sendiri.

## Batasan Penting
- Jangan mengubah atau merusak halaman form pendaftaran yang sudah berjalan.
- Jangan menampilkan daftar nama semua pendaftar/pelolos secara publik di satu halaman — hanya lookup per individu.
- Jangan menebak data yang ambigu (NIM kosong, nama ganda) — tanyakan dulu ke aku.
- Jangan push ke GitHub tanpa persetujuanku secara eksplisit.
