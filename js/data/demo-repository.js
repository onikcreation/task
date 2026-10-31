const NOW = Date.now();
const day = 86400000;
const SAMPLE = [
  ['UUU-00021','অনলাইন ভর্তি প্রক্রিয়ায় Payment API আপডেট','Admission > Online Payment','Urgent','Pending','UMS','Bug',0],
  ['UUU-00020','Desktop App লোড হচ্ছে না','Desktop App','Top','Pending','App','Bug',1],
  ['UUU-00019','Student profile-এ নতুন filter প্রয়োজন','Student > Information','Medium','Task Added','UMS','Feature',2],
  ['UUU-00018','Result publish report যাচাই','Exam > Result','Regular','Done','UMS','Our Task',3],
  ['UUU-00017','Teacher portal notification issue','Teacher > Notification','Urgent','Task Added','Teacher Portal','Bug',4],
  ['UUU-00016','Website course card responsive update','Website > Course','Low','Backlog','Website','Feature',8],
  ['UUU-00015','Qmaster question sync review','Qmaster > Sync','Medium','Pending','Qmaster','Developer Help',12],
  ['UUU-00014','CRM lead status mapping','CRM > Lead','Regular','Canceled','UMS','Our Task',18],
  ['UUU-00013','App version field validation','App > Settings','Top','Pending','App','Bug',25],
  ['UUU-00012','Branch report download পরীক্ষা','Admin > Report','Low','Done','UMS','Our Task',32]
].map((row,index)=>({id:row[0],title:row[1],menuPath:row[2],priority:row[3],status:row[4],platform:row[5],taskType:row[6],details:row[1]+' — ডেমো মোডের নমুনা তথ্য।',createdAt:new Date(NOW-row[7]*day).toISOString(),approvedBy:index%3===0?['Liton Vai']:[]}));

function text(task){return [task.id,task.title,task.details,task.menuPath,task.platform,task.taskType].join(' ').toLowerCase()}

export function createDemoRepository(){
  return {
    mode:'demo',
    async getSpecialViews(){return [{id:'our',name:'Our Task',color:'#7C3AED',active:true,tag:true,condition:{taskType:['Our Task']}},{id:'liton',name:'Liton Vai',color:'#EA580C',active:true,tag:true,condition:{person:['Liton Vai']}}]},
    async getDashboard(){const active=SAMPLE;const grouped=key=>Object.fromEntries([...new Set(active.map(row=>row[key]||'Unspecified'))].map(value=>[value,active.filter(row=>(row[key]||'Unspecified')===value).length]));return {total:active.length,open:active.filter(row=>['Pending','Task Added'].includes(row.status)).length,done:active.filter(row=>row.status==='Done').length,deleted:0,byStatus:grouped('status'),byPriority:grouped('priority'),byPlatform:grouped('platform'),byMonth:[]}},
    async getActivity(){return SAMPLE.slice(0,6).map((task,index)=>({id:index,kind:'task',action:'demo_activity',target:task.id,actor:'Demo',message:task.title,at:task.createdAt}))},
    async getSummary(){
      const pending=SAMPLE.filter(t=>['Pending','Task Added'].includes(t.status));
      return {pending:pending.length,urgent:pending.filter(t=>t.priority==='Urgent').length,waiting:pending.filter(t=>t.status==='Pending').length,added:pending.filter(t=>t.status==='Task Added').length,total:SAMPLE.length,statuses:[...new Set(SAMPLE.map(t=>t.status))]};
    },
    async listTasks(query={}){
      let rows=SAMPLE.slice();
      if(query.view==='pending')rows=rows.filter(t=>['Pending','Task Added'].includes(t.status));
      if(query.view==='our')rows=rows.filter(t=>t.taskType==='Our Task');
      if(query.view==='liton')rows=rows.filter(t=>t.approvedBy.includes('Liton Vai'));
      if(query.specialView){const condition=query.specialView.condition||query.specialView.cond||{};const list=value=>Array.isArray(value)?value:[value];if(condition.taskType||condition.type)rows=rows.filter(t=>list(condition.taskType||condition.type).includes(t.taskType));if(condition.person)rows=rows.filter(t=>list(condition.person).some(person=>t.approvedBy.includes(person)));if(condition.status)rows=rows.filter(t=>list(condition.status).includes(t.status));if(condition.priority)rows=rows.filter(t=>list(condition.priority).includes(t.priority));if(condition.platform)rows=rows.filter(t=>list(condition.platform).includes(t.platform))}
      if(query.status)rows=rows.filter(t=>t.status===query.status);
      if(query.search)rows=rows.filter(t=>text(t).includes(query.search.toLowerCase()));
      if(query.date==='today')rows=rows.filter(t=>NOW-new Date(t.createdAt).getTime()<day);
      if(query.date==='week')rows=rows.filter(t=>NOW-new Date(t.createdAt).getTime()<7*day);
      if(query.date==='month')rows=rows.filter(t=>NOW-new Date(t.createdAt).getTime()<31*day);
      const priorities=['Urgent','Top','Medium','Regular','Low'];
      rows.sort(query.sort==='oldest'?(a,b)=>new Date(a.createdAt)-new Date(b.createdAt):query.sort==='priority'?(a,b)=>priorities.indexOf(a.priority)-priorities.indexOf(b.priority):(a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
      const offset=query.offset||0,limit=query.limit||8;
      return {items:rows.slice(offset,offset+limit),total:rows.length,hasMore:offset+limit<rows.length};
    }
  };
}

