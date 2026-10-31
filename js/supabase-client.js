const SDK_URL='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export async function createBrowserSupabase(config){
  if(!config.supabaseUrl||!config.supabasePublishableKey)throw new Error('Supabase public configuration অসম্পূর্ণ।');
  const {createClient}=await import(SDK_URL);
  return createClient(config.supabaseUrl,config.supabasePublishableKey,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,flowType:'implicit'}
  });
}
