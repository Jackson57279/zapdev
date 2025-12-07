import { Link as RouterLink } from "@tanstack/react-router";
import React, { forwardRef } from "react";

type RouterLinkProps = Omit<React.ComponentPropsWithRef<typeof RouterLink>, "ref">;
type RouterLinkInstance = React.ComponentRef<typeof RouterLink>;

type InternalRouterLinkProps = Omit<RouterLinkProps, "to"> & {
  to: string;
};

export type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> &
  Omit<InternalRouterLinkProps, "to"> & {
    href: string;
    prefetch?: boolean;
  };

const Link = forwardRef<HTMLAnchorElement | RouterLinkInstance, LinkProps>(
  function NextCompatLink({ href, children, prefetch: _prefetch, ...rest }, ref) {
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
        to={href}
        ref={ref}
        {...rest}
      >
        {children}
      </RouterLink>
    );
  });

export default Link;
