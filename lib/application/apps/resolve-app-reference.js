import { ApplicationError } from "../../domain/errors.js";

export function resolveAppReference(apps, reference) {
  const app = apps.find((candidate) => (
    candidate.name === reference || String(candidate.id) === String(reference)
  ));

  if (!app) {
    throw new ApplicationError(`App "${reference}" não encontrado.`, {
      kind: "not-found",
      details: { reference },
    });
  }

  return app;
}
