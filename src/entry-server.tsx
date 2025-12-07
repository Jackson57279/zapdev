import { StartServer } from "@tanstack/start/server";
import { createRouter } from "./router";
import { handleApiRequest } from "./server/api-handler";

const router = createRouter();

export default StartServer({
  router,
  createFetchHandler:
    (startHandler) =>
    async (request, env, ctx) => {
      const apiResponse = await handleApiRequest(request, env);
      if (apiResponse) {
        return apiResponse;
      }
      return startHandler(request, env, ctx);
    },
});
