// TODO: Validate
import { JsonShapeError } from "./json-fields";
import { API_ORIGIN, ApiException } from "./stream-channeler-api";

// TODO: Validate
export function describeLoadError(loadError: unknown): string {
  if (loadError instanceof ApiException && loadError.isSignInRejected) return "your sign-in has expired";
  if (loadError instanceof ApiException) return `the server answered ${loadError.statusCode}: ${loadError.message}`;
  if (loadError instanceof JsonShapeError || loadError instanceof SyntaxError) {
    return `the server sent data the app can't read (${loadError.message})`;
  }
  if (loadError instanceof DOMException && (loadError.name === "TimeoutError" || loadError.name === "AbortError")) {
    return "the server took too long to answer";
  }
  if (loadError instanceof TypeError) {
    return `can't reach ${API_ORIGIN.replace("https://", "")}. Check your internet connection`;
  }
  if (loadError instanceof Error) return loadError.message || loadError.name;
  return String(loadError);
}

// TODO: Validate
export function isSignInRejectedError(loadError: unknown): boolean {
  return loadError instanceof ApiException && loadError.isSignInRejected;
}

// TODO: Validate
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
