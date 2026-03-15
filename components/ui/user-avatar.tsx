"use client";

import * as React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "h-6 w-6",
  md: "h-8 w-8",
  lg: "h-10 w-10",
} as const;

const TEXT_SIZES = {
  sm: "text-[9px]",
  md: "text-xs",
  lg: "text-sm",
} as const;

const BG_COLORS = [
  "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300",
  "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  "bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300",
  "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  "bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300",
];

function hashName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

interface UserAvatarProps {
  avatarUrl?: string | null;
  imageUrl?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function UserAvatar({
  avatarUrl,
  imageUrl,
  firstName,
  lastName,
  email,
  size = "md",
  className,
}: UserAvatarProps) {
  const src = avatarUrl || imageUrl || undefined;

  const initials = React.useMemo(() => {
    if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase();
    if (firstName) return firstName.substring(0, 2).toUpperCase();
    if (email) return email.substring(0, 2).toUpperCase();
    return "?";
  }, [firstName, lastName, email]);

  const bgColor = React.useMemo(() => {
    const name = `${firstName || ""}${lastName || ""}${email || ""}`;
    return BG_COLORS[hashName(name) % BG_COLORS.length];
  }, [firstName, lastName, email]);

  return (
    <Avatar className={cn(SIZES[size], className)}>
      {src && <AvatarImage src={src} />}
      <AvatarFallback className={cn(TEXT_SIZES[size], "font-semibold", bgColor)}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
