// Pendaftaran loader untuk tes unit (dipakai via --import, cara modern
// pengganti --loader). Lihat tests/loader.mjs untuk dokumentasi.
import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./loader.mjs", pathToFileURL("./tests/"));
