const COLUMNS='id,source_task_id,task_no,title,details,priority,status,task_type,platform,menu_path,action_status,progress,reg_pin,module,app_version,issued_department,issued_person,approved_by,links,discussions,solution,remarks,created_by_name,updated_by_name,revision,created_at,updated_at,recorded_at,is_deleted,deleted_at';
const OPEN_STATUSES=['Pending','Task Added'];

function fail(error){if(error)throw new Error(error.message||'Supabase request ব্যর্থ হয়েছে।')}
function mapped(row){return {dbId:row.id,id:row.source_task_id||row.task_no||row.id,taskNo:row.task_no,title:row.title,details:row.details,menuPath:row.menu_path,priority:row.priority,status:row.status,platform:row.platform,taskType:row.task_type,actionStatus:row.action_status,progress:row.progress,regPin:row.reg_pin,module:row.module,appVersion:row.app_version,issuedDepartment:row.issued_department,issuedPerson:row.issued_person,approvedBy:row.approved_by||[],links:row.links||[],discussions:row.discussions||[],solution:row.solution,remarks:row.remarks,createdByName:row.created_by_name,updatedByName:row.updated_by_name,revision:row.revision,createdAt:row.created_at||row.updated_at||row.recorded_at,updatedAt:row.updated_at,isDeleted:Boolean(row.is_deleted),deletedAt:row.deleted_at}}
async function count(query){const {count,error}=await query;fail(error);return count||0}
function cleanSearch(value){return String(value||'').replace(/[%_(),]/g,' ').trim()}
function names(items=[]){return items.filter(item=>typeof item==='string'||item?.active!==false).map(item=>typeof item==='string'?item:item?.name).filter(Boolean)}
function one(data){return mapped(Array.isArray(data)?data[0]:data)}
function values(value){return (Array.isArray(value)?value:[value]).map(item=>String(item||'').trim()).filter(Boolean)}
function applySpecialView(request,view){
  const condition=view?.condition||view?.cond||{};
  const taskTypes=values(condition.taskType||condition.type);if(taskTypes.length)request=request.in('task_type',taskTypes);
  const statuses=values(condition.status);if(statuses.length)request=request.in('status',statuses);
  const priorities=values(condition.priority);if(priorities.length)request=request.in('priority',priorities);
  const platforms=values(condition.platform);if(platforms.length)request=request.in('platform',platforms);
  const people=values(condition.person).map(cleanSearch).filter(Boolean);if(people.length){const terms=people.flatMap(person=>{const arrayItem=person.replaceAll('\\','\\\\').replaceAll('"','\\"');return [`issued_person.ilike.%${person}%`,`approved_by.cs.{"${arrayItem}"}`]});request=request.or(terms.join(','))}
  return request;
}

export function createSupabaseRepository(client){
  return {
    mode:'supabase',
    async getProfile(){const {data,error}=await client.rpc('current_profile');fail(error);const row=Array.isArray(data)?data[0]:data;if(!row||!row.is_active)throw new Error('এই account-টির Task Tracker access সক্রিয় নয়।');return row},
    async getSummary(){
      const active=()=>client.from('tasks').select('*',{count:'exact',head:true}).eq('is_deleted',false);
      const [pending,urgent,waiting,added,total,settings]=await Promise.all([
        count(active().in('status',OPEN_STATUSES)),count(active().in('status',OPEN_STATUSES).eq('priority','Urgent')),
        count(active().eq('status','Pending')),count(active().eq('status','Task Added')),count(active()),
        client.from('app_settings').select('value').eq('key','lists').maybeSingle()
      ]);
      fail(settings.error);const rawStatuses=settings.data?.value?.status||['Pending','Task Added','Backlog','Done','Canceled'];
      const statuses=rawStatuses.map(item=>typeof item==='string'?item:item?.name).filter((name,index)=>name&&(typeof rawStatuses[index]==='string'||rawStatuses[index]?.active!==false));
      const statusCounts=Object.fromEntries(await Promise.all(statuses.map(async status=>[status,await count(active().eq('status',status))])));
      return {pending,urgent,waiting,added,total,statuses,statusCounts};
    },
    async getOptions(){const {data,error}=await client.from('app_settings').select('value').eq('key','lists').single();fail(error);const value=data?.value||{};return {priority:names(value.priority),status:names(value.status),taskType:names(value.type),platform:names(value.platform),department:names(value.dept),person:names(value.person),actionStatus:names(value.action),progress:names(value.progress),module:names(value.module)}},
    async getDesignSettings(){const {data,error}=await client.from('app_settings').select('value').eq('key','design').maybeSingle();fail(error);const value=data?.value||{};return {defaultPreset:value.defaultPreset||'calm',allowUserOverride:value.allowUserOverride!==false}},
    async getPermissions(){const actions=['add','edit','status','delete','export','settings'];const values=await Promise.all(actions.map(async action=>{const {data,error}=await client.rpc('has_permission',{requested_action:action});fail(error);return [action,Boolean(data)]}));return Object.fromEntries(values)},
    async getSpecialViews(){const {data,error}=await client.from('app_settings').select('key,value').in('key',['views','specialViews']);fail(error);const rows=data||[],preferred=rows.find(row=>row.key==='views')||rows.find(row=>row.key==='specialViews');return Array.isArray(preferred?.value)?preferred.value:[]},
    async getDashboard(){
      const now=new Date(),start=new Date(now.getFullYear(),now.getMonth(),1),[dashboard,rows]=await Promise.all([
        client.rpc('get_task_dashboard'),
        client.from('tasks').select('created_at').eq('is_deleted',false).gte('created_at',start.toISOString()).lte('created_at',now.toISOString())
      ]);fail(dashboard.error);fail(rows.error);
      const counts=new Map();for(const row of rows.data||[]){const date=new Date(row.created_at);if(!Number.isNaN(date.getTime()))counts.set(date.getDate(),(counts.get(date.getDate())||0)+1)}
      const byDay=Array.from({length:now.getDate()},(_,index)=>({label:String(index+1),date:`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(index+1).padStart(2,'0')}`,count:counts.get(index+1)||0}));
      return {...(dashboard.data||{}),byDay};
    },
    async getActivity(includeAdmin=false){
      const taskRequest=client.from('task_logs').select('id,source_task_id,actor_name,action,message,changes,created_at,recorded_at').order('recorded_at',{ascending:false}).limit(100);
      const requests=[taskRequest];if(includeAdmin)requests.push(client.from('admin_audit_logs').select('id,actor_email,action,target,changes,created_at').order('created_at',{ascending:false}).limit(100));
      const results=await Promise.all(requests);results.forEach(result=>fail(result.error));
      const task=(results[0].data||[]).map(row=>({...row,kind:'task',actor:row.actor_name||'System',target:row.source_task_id||'Task',at:row.created_at||row.recorded_at}));
      const admin=(results[1]?.data||[]).map(row=>({...row,kind:'admin',actor:row.actor_email||'System',at:row.created_at}));
      return task.concat(admin).sort((a,b)=>new Date(b.at||0)-new Date(a.at||0)).slice(0,100);
    },
    async getAdminUsers(){const {data,error}=await client.from('user_access').select('email,display_name,role,is_active,updated_at').order('display_name',{ascending:true}).order('email',{ascending:true});fail(error);return data||[]},
    async getAdminLists(){const {data,error}=await client.from('app_settings').select('value').eq('key','lists').single();fail(error);return data?.value||{}},
    async getAdminAudit(){const {data,error}=await client.from('admin_audit_logs').select('id,actor_email,action,target,changes,created_at').order('created_at',{ascending:false}).limit(50);fail(error);return data||[]},
    async updateAdminUser(email,role,isActive){const {data,error}=await client.rpc('admin_update_user_access',{target_email:email,new_role:role,new_is_active:isActive});fail(error);return Array.isArray(data)?data[0]:data},
    async updateAdminList(listName,items){const {data,error}=await client.rpc('admin_update_list_setting',{list_name:listName,items});fail(error);return Array.isArray(data)?data[0]:data},
    async updateAdminSpecialViews(views){const {data,error}=await client.rpc('admin_update_special_views',{views});fail(error);return data||[]},
    async updateAdminDesign(defaultPreset,allowUserOverride){const {data,error}=await client.rpc('admin_update_design_setting',{new_default:defaultPreset,new_allow_user_override:allowUserOverride});fail(error);const row=Array.isArray(data)?data[0]:data,value=row?.value||{};return {defaultPreset:value.defaultPreset||defaultPreset,allowUserOverride:value.allowUserOverride!==false}},
    async createTask(payload){const {data,error}=await client.rpc('create_task',{payload});fail(error);return one(data)},
    async updateTask(dbId,expectedRevision,patch){const {data,error}=await client.rpc('update_task',{task_id:dbId,expected_revision:expectedRevision,patch});fail(error);return one(data)},
    async setTaskStatus(dbId,expectedRevision,newStatus){const {data,error}=await client.rpc('set_task_status',{task_id:dbId,expected_revision:expectedRevision,new_status:newStatus});fail(error);return one(data)},
    async softDeleteTask(dbId,expectedRevision){const {data,error}=await client.rpc('soft_delete_task',{task_id:dbId,expected_revision:expectedRevision});fail(error);return one(data)},
    async restoreTask(dbId,expectedRevision){const {data,error}=await client.rpc('restore_task',{task_id:dbId,expected_revision:expectedRevision});fail(error);return one(data)},
    async getTaskLogs(dbId){const {data,error}=await client.from('task_logs').select('id,action,message,changes,actor_name,created_at,recorded_at').eq('task_id',dbId).order('created_at',{ascending:false,nullsFirst:false}).order('recorded_at',{ascending:false});fail(error);return data||[]},
    async listTasks(query={}){
      let request=client.from('tasks').select(COLUMNS,{count:'exact'}).eq('is_deleted',query.view==='deleted');
      if(query.view==='pending')request=request.in('status',OPEN_STATUSES);
      if(query.view==='our')request=request.eq('task_type','Our Task');
      if(query.view==='liton')request=request.or('approved_by.cs.{"Liton Vai"},issued_person.ilike.%Liton Vai%');
      if(query.specialView)request=applySpecialView(request,query.specialView);
      if(query.status)request=request.eq('status',query.status);
      if(query.priority)request=request.eq('priority',query.priority);
      const search=cleanSearch(query.search);if(search)request=request.or(`source_task_id.ilike.%${search}%,task_no.ilike.%${search}%,title.ilike.%${search}%,details.ilike.%${search}%,menu_path.ilike.%${search}%,reg_pin.ilike.%${search}%`);
      const now=new Date(),start=new Date(now),end=new Date(now);start.setHours(0,0,0,0);end.setHours(23,59,59,999);
      if(query.date==='today')request=request.gte('created_at',start.toISOString()).lte('created_at',end.toISOString());
      else if(query.date==='yesterday'){start.setDate(start.getDate()-1);end.setDate(end.getDate()-1);request=request.gte('created_at',start.toISOString()).lte('created_at',end.toISOString())}
      else if(query.date==='week'){start.setDate(start.getDate()-((start.getDay()+1)%7));request=request.gte('created_at',start.toISOString()).lte('created_at',end.toISOString())}
      else if(query.date==='month'){start.setDate(1);request=request.gte('created_at',start.toISOString()).lte('created_at',end.toISOString())}
      else if(query.date==='lastmonth'){start.setMonth(start.getMonth()-1,1);end.setDate(0);end.setHours(23,59,59,999);request=request.gte('created_at',start.toISOString()).lte('created_at',end.toISOString())}
      else if(query.date==='custom'){if(query.dateFrom)request=request.gte('created_at',new Date(`${query.dateFrom}T00:00:00`).toISOString());if(query.dateTo)request=request.lte('created_at',new Date(`${query.dateTo}T23:59:59.999`).toISOString())}
      if(query.sort==='oldest')request=request.order('created_at',{ascending:true,nullsFirst:false});
      else if(query.sort==='priority')request=request.order('priority',{ascending:true}).order('created_at',{ascending:false,nullsFirst:false});
      else request=request.order('created_at',{ascending:false,nullsFirst:false}).order('recorded_at',{ascending:false});
      const offset=query.offset||0,limit=query.limit||50;const {data,error,count:total}=await request.range(offset,offset+limit-1);fail(error);
      return {items:(data||[]).map(mapped),total:total||0,hasMore:offset+(data?.length||0)<(total||0)};
    }
  };
}
