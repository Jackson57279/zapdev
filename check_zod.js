const { z } = require("zod");
console.log("z.toJSONSchema type:", typeof z.toJSONSchema);
try {
    console.log("z.toJSONSchema:", z.toJSONSchema(z.string()));
} catch (e) {
    console.log("Error calling toJSONSchema:", e.message);
}
