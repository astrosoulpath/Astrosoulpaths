// Synthetic Firebase verifier ONLY inside this disposable process. Real context
// credentials, canonical reads, Nest guards, DTOs, ownership and database.
module.exports=async({load,db,owner,foreign,admin,support,management,catalogue,notifications,check})=>{
 const assert=require('assert/strict'),crypto=require('crypto');
 const {Test}=load('node_modules/@nestjs/testing'),{Reflector}=load('node_modules/@nestjs/core'),{ConfigService}=load('node_modules/@nestjs/config'),{ValidationPipe,UnauthorizedException}=load('node_modules/@nestjs/common');
 const identity=load('dist/common/auth/firebase-google-identity.js'),context=load('dist/common/auth/context-session.js');
 const previous=identity.verifyFirebaseGoogleIdentity,identities=new Map();
 process.env.AUTH_CONTEXT_SESSION_KEY=crypto.randomBytes(32).toString('hex');process.env.ADMIN_ALLOWED_FIREBASE_UID='synthetic-operator-uid';
 try{
  for(const [row,uid] of [[owner,'synthetic-customer-uid'],[foreign,'synthetic-foreign-uid'],[admin,'synthetic-operator-uid']]){
   const email=uid+'@example.invalid';await db.user.update({where:{id:row.id},data:{email}});
   await db.userAuthIdentity.create({data:{userId:row.id,provider:'firebase',providerUserId:uid,identityType:'google',email}});
   identities.set(uid,{uid,email,googleEmail:email,googleSubject:'synthetic-subject-'+uid,tokenGoogleSubjects:['synthetic-subject-'+uid],firebaseUserDisabled:false,expiresAt:Math.floor(Date.now()/1000)+3600});
  }
  identity.verifyFirebaseGoogleIdentity=async token=>{if(!identities.has(token))throw new UnauthorizedException('Synthetic provider session revoked');return identities.get(token);};
  console.log('Synthetic HTTP checkpoint: canonical mappings seeded');
  const users=context.contextIdentityReader(db),credentials={};
  for(const [name,uid,portal] of [['customer','synthetic-customer-uid','customer'],['foreign','synthetic-foreign-uid','customer'],['admin','synthetic-operator-uid','admin']])credentials[name]=(await context.establishContextSession(uid,portal,users)).accessToken;
  console.log('Synthetic HTTP checkpoint: encrypted context credentials established');
  const {SupabaseJwtService}=load('dist/infrastructure/supabase/supabase-jwt.service.js'),{CommunicationAuthService}=load('dist/infrastructure/supabase/communication-auth.service.js');
  const config=new ConfigService({supabase:{url:'https://synthetic.invalid',jwtAudience:'authenticated'},NODE_ENV:'test',LOCAL_OTP_ENABLED:'false'});
  const jwt=new SupabaseJwtService(config,db),communication=new CommunicationAuthService(jwt,db,{getClient(){throw Error('External identity provider forbidden');}},config);
  const {NotificationsIdentityGuard}=load('dist/module/notifications/notifications-identity.guard.js'),{SupabaseAuthGuard}=load('dist/common/guards/supabase-auth.guard.js'),{RolesGuard}=load('dist/common/guards/roles.guard.js');
  const {SupportController}=load('dist/module/support/support.controller.js'),{SupportAdminController}=load('dist/module/support/support-admin.controller.js'),{SupportCatalogueController}=load('dist/module/support/support-catalogue.controller.js'),{NotificationsController}=load('dist/module/notifications/notifications.controller.js');
  const {SupportService}=load('dist/module/support/support.service.js'),{SupportAdminService}=load('dist/module/support/support-admin.service.js'),{SupportCatalogueService}=load('dist/module/support/support-catalogue.service.js'),{SupportAttachmentService}=load('dist/module/support/support-attachment.service.js'),{NotificationsService}=load('dist/module/notifications/notifications.service.js'),{NotificationsPushService}=load('dist/module/notifications/notifications.push.service.js');
  const unavailable={}; // No provider methods; accidental invocation fails.
  console.log('Synthetic HTTP checkpoint: real guards constructed');
  const {AdminController}=load('dist/module/admin/admin.controller.js'),{AdminModerationController}=load('dist/module/admin/admin-moderation.controller.js'),{AdminModerationService}=load('dist/module/admin/admin-moderation.service.js'),{AdminService}=load('dist/module/admin/admin.service.js'),{AdminReportService}=load('dist/module/admin/admin-report.service.js'),{NotificationsCampaignService}=load('dist/module/notifications/notifications.campaign.service.js');
  const fixture=await require('./moderation-workflows.cjs').prepare({load,db,owner,check,context,users});
  const moderation=new AdminModerationService(db),reports=new AdminReportService(db);
  const adminService=new AdminService({findAstrologerById:async id=>db.astrologer.findUnique({where:{id}})},fixture.storage,db,notifications,{},{});
  const module=await Test.createTestingModule({controllers:[AdminController,AdminModerationController,SupportController,SupportAdminController,SupportCatalogueController,NotificationsController],providers:[{provide:AdminService,useValue:adminService},{provide:AdminReportService,useValue:reports},{provide:AdminModerationService,useValue:moderation},{provide:NotificationsCampaignService,useValue:{}},{provide:SupportService,useValue:support},{provide:SupportAdminService,useValue:management},{provide:SupportCatalogueService,useValue:catalogue},{provide:SupportAttachmentService,useValue:unavailable},{provide:NotificationsService,useValue:notifications},{provide:NotificationsPushService,useValue:unavailable}]})
   .overrideGuard(NotificationsIdentityGuard).useValue(new NotificationsIdentityGuard(communication,users))
   .overrideGuard(SupabaseAuthGuard).useValue(new SupabaseAuthGuard(new Reflector(),jwt,users))
   .overrideGuard(RolesGuard).useValue(new RolesGuard(new Reflector(),db)).compile();
  console.log('Synthetic HTTP checkpoint: Nest module compiled');
  const app=module.createNestApplication({logger:false});
  try{
   app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));await app.init();
   const request=load('node_modules/supertest'),server=app.getHttpServer(),auth=name=>'Bearer '+credentials[name];
   await request(server).get('/support/tickets').expect(401);
   const response=await request(server).post('/support/tickets').set('Authorization',auth('customer')).send({subject:'SYNTHETIC HTTP website ticket',description:'Synthetic context credential, no real provider'}).expect(201);
   const id=response.body.ticket.id;
   await request(server).post('/admin/support/tickets/'+id+'/messages').set('Authorization',auth('admin')).send({content:'SYNTHETIC HTTP operator reply',clientMessageId:'http-reply'}).expect(201);
   const reloaded=await request(server).get('/support/tickets/'+id).set('Authorization',auth('customer')).expect(200);
   check('Real context credential HTTP ticket/reply/reload',reloaded.body.ticket.messages.some(m=>m.content==='SYNTHETIC HTTP operator reply'));
   await request(server).get('/support/tickets/'+id).set('Authorization',auth('foreign')).expect(404);
   // An Admin route requires an Admin context credential, so a Customer context
   // is an authentication-context mismatch (401), before role evaluation.
   await request(server).get('/admin/support/tickets').set('Authorization',auth('customer')).expect(401);
   await request(server).post('/support/tickets').set('Authorization',auth('customer')).send({subject:'x',customerId:foreign.id}).expect(400);
   check('Real guards reject cross-account reads, customer Admin access and injected ownership',true);
   const inbox=await request(server).get('/notifications').set('Authorization',auth('customer')).expect(200);check('HTTP inbox is bound to canonical customer',inbox.body.data.ownerId===owner.id);
   const published=await request(server).get('/admin/support/assistant/config').set('Authorization',auth('admin')).expect(200);check('Verified operator can inspect published catalogue',published.body.publishedRevision===2);
   const another=await context.establishContextSession('synthetic-customer-uid','customer',users);assert.notEqual(another.accessToken,credentials.customer);
   check('Separate client sessions map to same canonical account',(await context.verifyContextSession(another.accessToken,'customer',users)).canonicalUserId===owner.id);
   await require('./moderation-workflows.cjs').verify({...fixture,load,db,owner,foreign,check,context,users,request,server,auth,identities});
   identities.delete('synthetic-customer-uid');await request(server).get('/notifications').set('Authorization',auth('customer')).expect(401);check('Revoked source identity invalidates existing context session',true);
  }finally{await app.close();}
 }finally{identity.verifyFirebaseGoogleIdentity=previous;}
};
