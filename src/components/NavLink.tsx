import { NavLink as RouterNavLink, NavLinkProps } from "react-router-dom";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

// Update the props to correctly extend NavLinkProps
interface NavLinkCompatProps extends NavLinkProps {}

const NavLink = forwardRef<HTMLAnchorElement, NavLinkCompatProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <RouterNavLink
        ref={ref}
        {...props}
        className={({ isActive, isPending }) =>
          cn(
            // If the passed className is a function, call it with the state
            typeof className === "function"
              ? className({ isActive, isPending })
              // Otherwise, just use the string value
              : className,
            // You can still add your own logic here if you want to enforce
            // specific active or pending styles as a fallback.
            // For example:
            // isActive && "font-bold",
            // isPending && "opacity-50"
          )
        }
      >
        {children}
      </RouterNavLink>
    );
  },
);

NavLink.displayName = "NavLink";

export { NavLink };
