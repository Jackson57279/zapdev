import { StackServerApp } from "@stackframe/stack";

export const stackServerApp = new StackServerApp({
    tokenStore: "nextjs-cookie",
    urls: {
        signIn: "/handler/sign-in",
        signUp: "/handler/sign-up",
        afterSignIn: "/",
        afterSignUp: "/",
    },
    projectId: process.env.NEXT_PUBLIC_STACK_PROJECT_ID || "00000000-0000-4000-8000-000000000000",
    publishableClientKey: process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY || "placeholder-key",
    secretServerKey: process.env.STACK_SECRET_SERVER_KEY || "placeholder-secret",
});
