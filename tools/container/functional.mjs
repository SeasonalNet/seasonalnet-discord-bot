import assert from 'node:assert/strict';
import http from 'node:http';
import {Database} from '/app/dist/src/storage/database.js';
import {SeasonalAgentClient} from '/app/dist/src/integrations/seasonal-agent.js';
import {loadAgentCommands} from '/app/dist/src/modules/agents/commands.js';
let received;
const server=http.createServer(async(req,res)=>{
 if(req.url==='/healthz'){res.end('{}');return;}
 assert.equal(req.url,'/api/v1/bot/chat');assert.equal(req.headers.authorization,'Bearer synthetic');
 let raw='';for await(const part of req)raw+=part;received=JSON.parse(raw);
 res.setHeader('content-type','application/json');res.end(JSON.stringify({ok:true,session_id:received.session_id,reply:'Fixture answer',assistant_message:'Fixture answer',tool_rounds:1,used_tools:['fixture'],created_at:new Date().toISOString(),model:'fixture'}));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const database=new Database('/tmp/bot-functional.sqlite');
const settings={agents:{targets:{test:{display_name:'Test',description:'Fixture',agent_profile:'fixture',enabled:true}},max_question_length:1500,session_mode:'persistent'}};
const client=new SeasonalAgentClient(`http://127.0.0.1:${server.address().port}`,'synthetic',1000);
let deferred=false,reply;
try{
 assert.equal(await client.health(),'ok');
 const command=loadAgentCommands(settings)[0];assert.equal(command.data.toJSON().name,'ask');
 await command.execute({settings,database,seasonalAgent:client},{guildId:'guild',channelId:'channel',user:{id:'user',username:'tester'},channel:{name:'fixture'},guild:{name:'fixture'},options:{getString:name=>name==='target'?'test':'Fixture question'},deferReply:async()=>{deferred=true;},editReply:async payload=>{reply=payload;}});
 assert.equal(deferred,true);assert.equal(received.message,'Fixture question');assert.equal(received.session_id,'discord:guild:channel:user:target:test');assert.equal(received.persist_history,true);assert.equal(received.agent_profile,'fixture');
 assert.match(reply.embeds[0].toJSON().description,/Fixture answer/);
 database.logCommand({commandName:'ask',userId:'user',username:'tester',success:true,latencyMs:1,correlationId:'functional'});assert.equal(database.commandCount(),1);
}finally{database.close();await new Promise(r=>server.close(r));}
const reopened=new Database('/tmp/bot-functional.sqlite');assert.equal(reopened.commandCount(),1);reopened.close();
console.log('PASS bot command serialization/execution, defer/edit/embed, real Agent HTTP client, session metadata, SQLite audit/reopen; Discord transport simulated');
