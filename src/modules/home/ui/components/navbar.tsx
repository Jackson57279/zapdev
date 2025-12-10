"use client";

import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { useScroll } from "@/hooks/use-scroll";
import { Button } from "@/components/ui/button";
import { UserControl } from "@/components/user-control";
import {
  SignedIn,
  SignedOut,
  SignInButton,
  SignUpButton,
} from "@clerk/nextjs";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CalendarCheckIcon, MailIcon } from "lucide-react";


export const Navbar = () => {
  const isScrolled = useScroll();

  return (
    <>
      <nav
        className={cn(
          "p-4 bg-transparent fixed top-0 left-0 right-0 z-50 transition-all duration-200 border-b border-transparent",
          isScrolled && "bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-border"
        )}
      >
        <div className="max-w-7xl mx-auto w-full flex justify-between items-center">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/logo.svg" alt="ZapDev - AI-Powered Development Platform" width={24} height={24} />
              <span className="font-semibold text-lg">ZapDev</span>
            </Link>
            
            <NavigationMenu className="hidden md:flex">
              <NavigationMenuList>
                <NavigationMenuItem>
                  <Link href="/pricing" legacyBehavior passHref>
                    <NavigationMenuLink className={navigationMenuTriggerStyle()}>
                      Pricing
                    </NavigationMenuLink>
                  </Link>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm">
                  Need help
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <a
                    href="mailto:support@zapdev.link"
                    className="flex items-center gap-2"
                  >
                    <MailIcon className="size-4 text-muted-foreground" />
                    Email support
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a
                    href="https://cal.com/jacksonwheeler"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2"
                  >
                    <CalendarCheckIcon className="size-4 text-muted-foreground" />
                    Book a call
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <SignedOut>
              <div className="flex gap-2">
                <SignUpButton mode="modal">
                  <Button variant="outline" size="sm">
                    Sign up
                  </Button>
                </SignUpButton>
                <SignInButton mode="modal">
                  <Button size="sm">Sign in</Button>
                </SignInButton>
              </div>
            </SignedOut>
            <SignedIn>
              <UserControl showName />
            </SignedIn>
          </div>
        </div>
      </nav>
    </>
  );
};
