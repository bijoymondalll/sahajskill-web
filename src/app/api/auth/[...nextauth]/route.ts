import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

/** next-auth (v4) Google OAuth endpoints: /api/auth/* */
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
