export function parseLoginCallback(requestUrl) {
  const url = new URL(requestUrl, "http://localhost");
  return {
    token: url.searchParams.get("token"),
    user: url.searchParams.get("user"),
    error: url.searchParams.get("error"),
    message: url.searchParams.get("message"),
  };
}

export function createLoginUrl(baseUrl, port) {
  const url = new URL("/api/auth/cli/login/", baseUrl);
  url.searchParams.set("port", String(port));
  return url.toString();
}
