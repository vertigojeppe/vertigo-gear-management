import { ApiError, handler, json, readJson } from "@/lib/api/respond";
import { allocationInput, allocations, ConflictError } from "@/modules/projects";

/** Reserve gear for a project. Returns 409 with the conflict unless `force` is true. */
export const POST = handler<{ id: string }>("projects.write", async (req, actor, { id }) => {
  const input = await readJson(req, allocationInput);
  try {
    const result = await allocations.reserve(actor, id, input);
    return json({ data: result.allocation, check: result.check }, { status: 201 });
  } catch (err) {
    if (err instanceof ConflictError) throw new ApiError(409, err.message, err.check);
    throw err;
  }
});
