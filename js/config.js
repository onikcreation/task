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
  return {...DEFAULT_CONFIG,...publicConfig,...(globalThis.APP_CONFIG||{}),...localConfig};
}

