import Ajv from 'ajv';
import { SCHEMAS } from './schemas.js';
import { DataError, DATA_ERROR } from './errors.js';

const ajv = new Ajv({ allErrors: true, strict: false });
const validators = new Map(
  Object.entries(SCHEMAS).map(([name, schema]) => [name, ajv.compile(schema)]),
);

/**
 * @param {string} schemaName chiave di `SCHEMAS` (es. "game", "derived/deck")
 * @param {unknown} data
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validate(schemaName, data) {
  const check = validators.get(schemaName);
  if (!check) throw new Error(`Schema sconosciuto: ${schemaName}`);
  const valid = check(data);
  const errors = valid
    ? []
    : (check.errors ?? []).map((e) => `${e.instancePath || '/'} ${e.message}`);
  return { valid, errors };
}

/**
 * Come `validate`, ma lancia un `DataError` se il documento non è valido.
 * @param {string} schemaName
 * @param {unknown} data
 */
export function assertValid(schemaName, data) {
  const { valid, errors } = validate(schemaName, data);
  if (!valid) {
    throw new DataError(
      DATA_ERROR.invalid,
      `Dati non validi (${schemaName}): ${errors.join('; ')}`,
      errors,
    );
  }
}
