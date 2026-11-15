/** PI-CORE (accounts, passwords) lives at its own address; pmk-form only links to it. */
export const PICORE_URL = (process.env.NEXT_PUBLIC_PICORE_URL || "https://core.pmkitera.web.id").replace(/\/+$/, "");
export const PICORE_CHANGE_PASSWORD_URL = `${PICORE_URL}/change-password`;
