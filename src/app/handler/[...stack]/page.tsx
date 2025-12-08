import { StackHandler, StackServerApp } from "@stackframe/stack";

const stackProjectId =
  process.env.NEXT_PUBLIC_STACK_PROJECT_ID ||
  "00000000-0000-4000-8000-000000000000";
process.env.NEXT_PUBLIC_STACK_PROJECT_ID = stackProjectId;
process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY =
  process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY ||
  "pk_stack_placeholder";
process.env.STACK_SECRET_SERVER_KEY =
  process.env.STACK_SECRET_SERVER_KEY || "sk_stack_placeholder";

const stackServerApp = new StackServerApp({
  tokenStore: "nextjs-cookie",
});

export default function Handler(props: unknown) {
  return <StackHandler fullPage app={stackServerApp} routeProps={props} />;
}
