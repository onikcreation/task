import {createDemoRepository} from './demo-repository.js?v=20261031-11';
import {createSupabaseRepository} from './supabase-repository.js?v=20261031-11';

export async function createRepository(config,supabase){
  if(config.dataMode!=='supabase'||!config.supabaseUrl||!config.supabasePublishableKey)return createDemoRepository();
  if(!supabase)throw new Error('Supabase session পাওয়া যায়নি।');
  return createSupabaseRepository(supabase);
}

