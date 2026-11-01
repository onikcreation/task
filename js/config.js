export const DEFAULT_CONFIG = Object.freeze({
  appName: 'Task Tracker',
  dataMode: 'demo',
  supabaseUrl: '',
  supabasePublishableKey: '',
  pageSize: 8
});

export async function loadConfig() {
  const readJson=async path=>{
    try{
      const response=await fetch(path,{cache:'no-store'});
      return response.ok?await response.json():{};
    }catch(_error){return {}}
  };
  const publicConfig=await readJson('./app-config.public.json');
  const localConfig=await readJson('./app-config.local.json');
  const merged={...DEFAULT_CONFIG,...publicConfig,...(globalThis.APP_CONFIG||{}),...localConfig};
  const url=new URL(globalThis.location?.href||'http://localhost/');
  const localQa=['localhost','127.0.0.1'].includes(url.hostname)&&url.searchParams.get('qaDemo')==='1';
  return localQa?{...merged,dataMode:'demo',supabaseUrl:'',supabasePublishableKey:''}:merged;
}

