with s as (select id, stage_key from public.interview_stages)
insert into public.interview_questions (stage_id, question_key, question_text, question_type, sequence, required, ai_generated, help_text)
select s.id, q.question_key, q.question_text, q.question_type::public.question_type, q.seq, q.required, false, q.help_text
from s
join (values
 ('identity','identity_what_you_do','In your own words, what does your business actually do?','long_text',1,true,'A sentence or two is plenty.'),
 ('identity','identity_location','Where do you operate, and who do you serve geographically?','text',2,true,null),
 ('identity','identity_stage','How long have you been running, and how big is the team today?','text',3,false,null),
 ('products_services','services_main','What are your main services or products?','long_text',1,true,'List them the way you would to a customer.'),
 ('products_services','services_prices','What do you charge for each of them?','long_text',2,true,'Approximate is fine.'),
 ('products_services','services_best_seller','Which one brings in the most revenue?','text',3,false,null),
 ('customers','customers_who','Who are your best customers? Describe them.','long_text',1,true,null),
 ('customers','customers_find_you','How do most new customers currently find you?','long_text',2,true,null),
 ('customers','customers_volume','Roughly how many customers do you serve in a month?','number',3,false,null),
 ('problems','problems_customer_pain','What problem are customers really trying to solve when they come to you?','long_text',1,true,null),
 ('problems','problems_objections','What makes people hesitate before buying from you?','long_text',2,false,null),
 ('transformation','transformation_after','What is different in a customer''s life or business after working with you?','long_text',1,true,null),
 ('transformation','transformation_proof','What proof do you have that you deliver that outcome?','long_text',2,false,'Reviews, results, repeat rates — anything real.'),
 ('differentiation','differentiation_why_you','Why do customers choose you over the alternatives?','long_text',1,true,null),
 ('differentiation','differentiation_competitors','Who do you consider your main competitors?','long_text',2,false,null),
 ('methodology','methodology_delivery','Walk me through how you deliver your main service, start to finish.','long_text',1,true,null),
 ('methodology','methodology_standards','What has to be true for the work to be considered done well?','long_text',2,false,null),
 ('sales_marketing','marketing_channels','What are you currently doing to get new customers?','long_text',1,true,null),
 ('sales_marketing','sales_process','What happens between an enquiry and a paying customer?','long_text',2,true,null),
 ('sales_marketing','marketing_spend','How much do you spend on marketing in a typical month?','currency',3,false,null),
 ('operations','operations_daily','What does a normal working day look like operationally?','long_text',1,true,null),
 ('operations','operations_tracking','How do you keep track of jobs, bookings or orders today?','long_text',2,true,null),
 ('people','people_team','Who does what in the business right now?','long_text',1,true,null),
 ('people','people_owner_dependency','What can only you do, that nobody else can?','long_text',2,true,'This is where owner dependency shows up.'),
 ('economics','economics_revenue','What is your approximate monthly revenue?','currency',1,true,'A range or estimate is fine.'),
 ('economics','economics_costs','What are your biggest monthly costs?','long_text',2,true,null),
 ('economics','economics_margin','Do you know your rough profit margin on your main service?','text',3,false,null),
 ('technology','technology_tools','What software or tools do you use to run the business?','long_text',1,true,null),
 ('technology','technology_gaps','Where do you still rely on paper, memory or WhatsApp?','long_text',2,false,null),
 ('problems_bottlenecks','bottleneck_main','What is the single biggest thing holding the business back right now?','long_text',1,true,null),
 ('problems_bottlenecks','bottleneck_time','Where does most of your time disappear?','long_text',2,true,null),
 ('goals','goals_12_months','What do you want the business to look like in 12 months?','long_text',1,true,null),
 ('goals','goals_metric','If one number had to improve in the next 90 days, which one?','text',2,true,null),
 ('vision','vision_long_term','What is the long-term vision — where is this business going?','long_text',1,true,null),
 ('vision','vision_role','What role do you want to be playing in it?','long_text',2,false,null),
 ('evidence','evidence_sources','Is there anything you can share that shows how the business is performing?','long_text',1,false,'Screenshots, reports, reviews, spreadsheets.'),
 ('evidence','evidence_uncertain','Which of your answers were guesses you would like to verify later?','long_text',2,false,null)
) as q(stage_key, question_key, question_text, question_type, seq, required, help_text)
  on q.stage_key = s.stage_key
on conflict do nothing;