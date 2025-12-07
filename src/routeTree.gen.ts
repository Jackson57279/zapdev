import { createRouteTree } from "@tanstack/react-router";
import { Route as RootRoute } from "./routes/__root";
import { Route as IndexRoute } from "./routes/index";
import { Route as PricingRoute } from "./routes/pricing";
import { Route as AiInfoRoute } from "./routes/ai-info";
import { Route as ImportRoute } from "./routes/import";
import { Route as FrameworksRoute } from "./routes/frameworks";
import { Route as FrameworkSlugRoute } from "./routes/frameworks/$slug";
import { Route as ProjectsRoute } from "./routes/projects/$projectId";
import { Route as SettingsRoute } from "./routes/settings";
import { Route as SettingsIndexRoute } from "./routes/settings/_index";
import { Route as SettingsProfileRoute } from "./routes/settings/profile";
import { Route as SettingsSubscriptionRoute } from "./routes/settings/subscription";
import { Route as SettingsConnectionsRoute } from "./routes/settings/connections";
import { Route as SolutionsRoute } from "./routes/solutions";
import { Route as SolutionsSlugRoute } from "./routes/solutions/$slug";
import { Route as ShowcaseRoute } from "./routes/showcase";
import { Route as SentryExampleRoute } from "./routes/sentry-example-page";

const settingsTree = SettingsRoute.addChildren([
  SettingsIndexRoute,
  SettingsProfileRoute,
  SettingsSubscriptionRoute,
  SettingsConnectionsRoute,
]);

export const routeTree = createRouteTree(
  RootRoute.addChildren([
    IndexRoute,
    PricingRoute,
    AiInfoRoute,
    ImportRoute,
    FrameworksRoute,
    FrameworkSlugRoute,
    ProjectsRoute,
    settingsTree,
    SolutionsRoute,
    SolutionsSlugRoute,
    ShowcaseRoute,
    SentryExampleRoute,
  ]),
);
