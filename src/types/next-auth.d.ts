import type { DefaultSession } from "next-auth";
import type { UserRole } from "@/domain/entities/user";

declare module "next-auth" {
  interface User {
    role: UserRole;
  }

  interface Session {
    // id is users.id_user; Auth.js' own User.id stays a string.
    user: {
      id: number;
      role: UserRole;
    } & Omit<NonNullable<DefaultSession["user"]>, "id">;
  }
}

// next-auth/jwt only re-exports this interface (`export *`), which can't be
// augmented: the original module is. With pnpm it resolves only because
// @auth/core is a direct dependency (pinned to next-auth's version).
declare module "@auth/core/jwt" {
  interface JWT {
    id: number;
    role: UserRole;
  }
}
