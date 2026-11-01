import {createDemoRepository} from './demo-repository.js?v=20261101-20';
import {createSupabaseRepository} from './supabase-repository.js?v=20261101-20';

export async function createRepository(config,supabase){
  if(config.dataMode!=='supabase'||!config.supabaseUrl||!config.supabasePublishableKey)return createDemoRepository();
  if(!supabase)throw new Error('Supabase client পাওয়া যায়নি।');
  return createSupabaseRepository(supabase);
}

