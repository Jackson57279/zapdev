import React from "react";

export function Html({ children, ...rest }: React.HTMLAttributes<HTMLHtmlElement>) {
  return <html {...rest}>{children}</html>;
}

export function Head(props: React.HTMLAttributes<HTMLHeadElement>) {
  return <head {...props} />;
}

export function Main(props: React.HTMLAttributes<HTMLBodyElement>) {
  return <body {...props} />;
}

export function NextScript() {
  return null;
}
