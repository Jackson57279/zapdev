"use client";

import { Link } from "@tanstack/react-router";
import { useUser } from "@/lib/auth-client";
import { formatDistanceToNow } from "date-fns";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ProjectWithPreview = Doc<"projects"> & {
  previewAttachment: Doc<"attachments"> | null;
};

export const ProjectsList = () => {
  const user = useUser();
  const projects = useQuery(api.projects.list) as ProjectWithPreview[] | undefined;

  if (!user) return null;

  const userName = user.displayName?.split(" ")[0] || "";

  if (projects === undefined) {
    return (
      <div className="w-full bg-white dark:bg-sidebar rounded-xl p-8 border flex flex-col gap-y-6 sm:gap-y-4">
        <h2 className="text-2xl font-semibold">
          {userName ? `${userName}'s Apps` : "Your Apps"}
        </h2>
        <div className="flex items-center justify-center py-8">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white dark:bg-sidebar rounded-xl p-8 border flex flex-col gap-y-6 sm:gap-y-4">
      <h2 className="text-2xl font-semibold">
        {userName ? `${userName}'s Apps` : "Your Apps"}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {projects.length === 0 && (
          <div className="col-span-full text-center">
            <p className="text-sm text-muted-foreground">
              No projects found
            </p>
          </div>
        )}
        {projects.map((project) => {
          const imageSrc = project.previewAttachment?.url ?? "/logo.svg";
          const hasPreviewImage = Boolean(project.previewAttachment?.url);
          const updatedAtSource = project.updatedAt ?? project._creationTime ?? Date.now();

          return (
            <Button
              key={project._id}
              variant="outline"
              className="font-normal h-auto justify-start w-full text-start p-4"
              asChild
            >
              <Link to={`/projects/${project._id}`}>
                <div className="flex items-center gap-x-4">
                  <Image
                    src={imageSrc}
                    alt={hasPreviewImage ? `${project.name} preview` : "ZapDev"}
                    width={48}
                    height={48}
                    className={cn(
                      "rounded-md border object-cover",
                      !hasPreviewImage && "border-none object-contain bg-muted p-2"
                    )}
                  />
                  <div className="flex flex-col">
                    <h3 className="truncate font-medium">
                      {project.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {formatDistanceToNow(updatedAtSource, {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </div>
              </Link>
            </Button>
          );
        })}
      </div>
    </div>
  );
};
