// Username validation now lives in the shared package so client and the
// authoritative server enforce the exact same rules. Re-exported here to keep
// existing import sites (`@/lib/validateUsername`) stable.
export {
  validateUsername,
  USERNAME_MIN,
  USERNAME_MAX,
  type UsernameResult,
} from "@wordspy/types";
