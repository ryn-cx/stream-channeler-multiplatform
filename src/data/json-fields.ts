// TODO: Validate
export type JsonObject = Record<string, unknown>;

// TODO: Validate
export class JsonShapeError extends Error {
  // TODO: Validate
  constructor(message: string) {
    super(message);
    this.name = "JsonShapeError";
  }
}

// TODO: Validate
export function isJsonObject(jsonValue: unknown): jsonValue is JsonObject {
  return typeof jsonValue === "object" && jsonValue !== null && !Array.isArray(jsonValue);
}

// TODO: Validate
export function requiredObject(parentJson: JsonObject, key: string): JsonObject {
  const childJson = parentJson[key];
  if (!isJsonObject(childJson)) throw new JsonShapeError(`"${key}" is not an object`);
  return childJson;
}

// TODO: Validate
export function requiredArray(parentJson: JsonObject, key: string): unknown[] {
  const childJson = parentJson[key];
  if (!Array.isArray(childJson)) throw new JsonShapeError(`"${key}" is not an array`);
  return childJson;
}

// TODO: Validate
export function requiredString(parentJson: JsonObject, key: string): string {
  const childJson = parentJson[key];
  if (typeof childJson === "string") return childJson;
  if (typeof childJson === "number") return String(childJson);
  throw new JsonShapeError(`"${key}" is not a string`);
}

// TODO: Validate
export function requiredBoolean(parentJson: JsonObject, key: string): boolean {
  const childJson = parentJson[key];
  if (typeof childJson !== "boolean") throw new JsonShapeError(`"${key}" is not a boolean`);
  return childJson;
}

// TODO: Validate
export function requiredNumber(parentJson: JsonObject, key: string): number {
  const childJson = parentJson[key];
  if (typeof childJson !== "number") throw new JsonShapeError(`"${key}" is not a number`);
  return childJson;
}

// TODO: Validate
export function optionalString(parentJson: JsonObject, key: string): string | null {
  const childJson = parentJson[key];
  if (typeof childJson === "number") return String(childJson);
  return typeof childJson === "string" && childJson.length > 0 ? childJson : null;
}

// TODO: Validate
export function optionalNumber(parentJson: JsonObject, key: string): number | null {
  const childJson = parentJson[key];
  return typeof childJson === "number" && !Number.isNaN(childJson) ? childJson : null;
}

// TODO: Validate
export function optionalBoolean(parentJson: JsonObject, key: string): boolean | null {
  const childJson = parentJson[key];
  return typeof childJson === "boolean" ? childJson : null;
}

// TODO: Validate
export function optionalObject(parentJson: JsonObject, key: string): JsonObject | null {
  const childJson = parentJson[key];
  return isJsonObject(childJson) ? childJson : null;
}

// TODO: Validate
export function arrayOfObjects(jsonArray: unknown[]): JsonObject[] {
  return jsonArray.map((arrayItem, arrayIndex) => {
    if (!isJsonObject(arrayItem)) throw new JsonShapeError(`item ${arrayIndex} is not an object`);
    return arrayItem;
  });
}

// TODO: Validate
export function arrayOfStrings(jsonArray: unknown[]): string[] {
  return jsonArray.map((arrayItem, arrayIndex) => {
    if (typeof arrayItem !== "string") throw new JsonShapeError(`item ${arrayIndex} is not a string`);
    return arrayItem;
  });
}
