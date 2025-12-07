import { Link as RouterLink } from "@tanstack/react-router";
import React, { forwardRef } from "react";

type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  prefetch?: boolean;
};

const Link = forwardRef<HTMLAnchorElement, LinkProps>(function NextCompatLink(
  { href, children, prefetch: _prefetch, ...rest },
  ref
) {
  const isExternal = /^https?:\/\//.test(href) || href.startsWith("mailto:") || href.startsWith("#");

  if (isExternal) {
    return (
      <a href={href} ref={ref} {...rest}>
        {children}
      </a>
    );
  }

  return (
    <RouterLink
      to={href as any}
      ref={ref as any}
      {...rest}
    >
      {children}
    </RouterLink>
  );
});

export default Link;
