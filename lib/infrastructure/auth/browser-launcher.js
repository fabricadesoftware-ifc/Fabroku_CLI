import open from "open";

export function createBrowserLauncher(openImpl = open) {
  return {
    open(url) {
      return openImpl(url);
    },
  };
}
