export async function sharedVersionLibrary<T>(options: {create: (storage: Storage) => T; key: string; game: string; normalize?: (value: Record<string, unknown>) => unknown}): Promise<T & {shared?: boolean}> {
 const requested = new URLSearchParams(location.hash.slice(1)).has('shared') || localStorage.getItem('faith-shared-edit-link-v1');
 if (!requested) return options.create(localStorage) as T & {shared?: boolean};
 const helper = await import(new URL('../birthday-darts/shared-versions.js?v=desk-v1', location.href).href);
 const library = await helper.connectVersionLibrary(options);
 await import(new URL('../birthday-darts/shared-settings-ui.js?v=desk-v1', location.href).href);
 const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = new URL('../birthday-darts/shared-settings.css', location.href).href; document.head.append(css);
 return library;
}
export async function rememberSharedLink() {
 if (new URLSearchParams(location.hash.slice(1)).has('shared')) {
  const helper = await import(new URL('../birthday-darts/shared-versions.js?v=desk-v1', location.href).href);
  helper.readSharedConnection();
 }
}
