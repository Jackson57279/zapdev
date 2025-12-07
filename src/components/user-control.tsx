"use client";

import { useUser } from "@/lib/auth-client";
import { useNavigate } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User, Settings } from "lucide-react";

interface Props {
  showName?: boolean;
}

export const UserControl = ({ showName }: Props) => {
  const navigate = useNavigate();
  const user = useUser();

  if (!user) return null;

  const handleSignOut = async () => {
    await user.signOut();
    navigate({ to: "/" });
  };

  const initials = user.displayName
    ?.split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase() || user.primaryEmail?.[0]?.toUpperCase() || "U";

  const avatarSrc = user.profileImageUrl ?? undefined;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md focus:outline-none">
        <Avatar className="size-8 rounded-md">
          <AvatarImage src={avatarSrc} />
          <AvatarFallback className="rounded-md">{initials}</AvatarFallback>
        </Avatar>
        {showName && (
          <span className="text-sm font-medium hidden md:inline-block">
            {user.displayName || user.primaryEmail}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.displayName}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.primaryEmail}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate({ to: "/dashboard" })}>
          <User className="mr-2 h-4 w-4" />
          <span>Dashboard</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
          <Settings className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-red-600">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
