export interface BuildVersion { commit: string; contentVersion: string; builtAt: string }
declare const __APP_BUILD__: BuildVersion;
export const buildVersion: BuildVersion = typeof __APP_BUILD__ === 'undefined'
  ? { commit: 'local', contentVersion: 'development', builtAt: '' } : __APP_BUILD__;

export function buildTime(value: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return '本地開發版本';
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date(value));
}
