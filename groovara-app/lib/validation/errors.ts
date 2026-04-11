import { ZodError } from "zod";

export function formatZodErrors(error: ZodError) {
  const flattened = error.flatten();

  return {
    fieldErrors: flattened.fieldErrors,
    formErrors: flattened.formErrors,
  };
}