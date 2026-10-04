#!/usr/bin/env bash
# Import kredensial service account Google ke .env lokal (sekali jalan).
#
# CARA PAKAI (setelah download file JSON dari Google Cloud Console):
#   ./scripts/import-sheets-env.sh ~/Downloads/nama-file-kunci.json
#
# YANG DILAKUKAN SKRIP INI:
#   1. Baca client_email + private_key dari file JSON.
#   2. Tulis/UPDATE GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY di .env
#      (private key dijadikan SATU BARIS dengan \n literal, sesuai yang
#      diharapkan lib/sheets/client.ts).
#   3. Buatkan CRON_SECRET acak bila belum ada (openssl rand -hex 32).
#   4. TIDAK PERNAH menghapus baris .env lain (Supabase dkk aman).
#
# KEAMANAN: .env sudah di .gitignore. JANGAN commit file JSON maupun .env.
# Hapus file JSON setelah import, atau simpan di luar repo.
set -euo pipefail

JSON_PATH="${1:-}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${2:-$REPO_ROOT/.env}"

if [[ -z "$JSON_PATH" ]]; then
  echo "Pakai: $0 /path/ke/service-account-key.json [path-ke-.env]"
  echo "Contoh: $0 ~/Downloads/pmk-form-sheets-abc123.json"
  exit 1
fi
if [[ ! -f "$JSON_PATH" ]]; then
  echo "ERROR: file tidak ditemukan: $JSON_PATH"
  exit 1
fi
if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: file env tidak ditemukan: $ENV_FILE"
  exit 1
fi

python3 - "$JSON_PATH" "$ENV_FILE" <<'PYEOF'
import json
import re
import secrets
import sys

json_path, env_path = sys.argv[1], sys.argv[2]

with open(json_path, encoding="utf-8") as f:
    key = json.load(f)

if key.get("type") != "service_account":
    print("PERINGATAN: file JSON ini bertipe '%s', bukan 'service_account'." % key.get("type"))
    print("Pastikan Anda mendownload kunci SERVICE ACCOUNT, bukan OAuth client.")

email = key.get("client_email", "").strip()
private_key = key.get("private_key", "")
if not email or not private_key:
    print("ERROR: client_email / private_key tidak ada di file JSON.")
    sys.exit(1)

# Jadikan satu baris: newline asli -> literal backslash-n.
private_key_flat = private_key.replace("\r\n", "\n").replace("\n", "\\n")

with open(env_path, encoding="utf-8") as f:
    lines = f.read().splitlines()

wanted = {
    "GOOGLE_SERVICE_ACCOUNT_EMAIL": email,
    'GOOGLE_PRIVATE_KEY': '"%s"' % private_key_flat,
}
found = set()
out = []
for line in lines:
    m = re.match(r"^([A-Za-z_][A-Za-z0-9_]*)\s*=", line)
    if m and m.group(1) in wanted:
        out.append("%s=%s" % (m.group(1), wanted[m.group(1)]))
        found.add(m.group(1))
    else:
        out.append(line)

missing = [k for k in wanted if k not in found]
if missing:
    if out and out[-1].strip() != "":
        out.append("")
    out.append("# --- Google Sheets service account (Fase 6, server saja, dari import JSON) ---")
    for k in missing:
        out.append("%s=%s" % (k, wanted[k]))

cron_generated = None
has_cron = any(re.match(r"^CRON_SECRET\s*=", ln) for ln in out)
if not has_cron:
    cron_generated = secrets.token_hex(32)
    out.append("CRON_SECRET=%s" % cron_generated)

with open(env_path, "w", encoding="utf-8") as f:
    f.write("\n".join(out) + "\n")

print("OK: .env diperbarui -> %s" % env_path)
print("  GOOGLE_SERVICE_ACCOUNT_EMAIL=%s" % email)
print("  GOOGLE_PRIVATE_KEY=(satu baris, %d char, diapit kutip)" % len(private_key_flat))
if cron_generated:
    print("  CRON_SECRET=(baru dibuat acak)")
else:
    print("  CRON_SECRET=(sudah ada, tidak diubah)")
print()
print("LANGKAH BERIKUTNYA:")
print("  1. Share spreadsheet TES sebagai Editor ke: %s" % email)
print("  2. Restart dev server, buka halaman edit form -> panel Integrasi Google Sheets")
print("     -> isi URL spreadsheet -> Simpan -> Tes Koneksi.")
print("  3. Hapus file JSON (atau pindahkan ke luar repo). JANGAN commit .env.")
PYEOF
