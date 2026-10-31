import {createDemoRepository} from './demo-repository.js?v=20261031-13';
import {createSupabaseRepository} from './supabase-repository.js?v=20261031-13';

export async function createRepository(config,supabase){
  if(config.dataMode!=='supabase'||!config.supabaseUrl||!config.supabasePublishableKey)return createDemoRepository();
  if(!supabase)throw new Error('Supabase client পাওয়া যায়নি।');
  return createSupabaseRepository(supabase);
}

