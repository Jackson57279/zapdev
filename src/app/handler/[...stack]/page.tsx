import { StackHandler, StackServerApp } from "@stackframe/stack";

const stackProjectId = process.env.NEXT_PUBLIC_STACK_PROJECT_ID;
const stackServerApp = stackProjectId
  ? new StackServerApp({
      tokenStore: "nextjs-cookie",
    })
  : null;

export default function Handler(props: unknown) {
  if (!stackServerApp) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Stack Auth is not configured. Set NEXT_PUBLIC_STACK_PROJECT_ID to enable
        auth handler routes.
      </div>
    );
  }

  return <StackHandler fullPage app={stackServerApp} routeProps={props} />;
}
