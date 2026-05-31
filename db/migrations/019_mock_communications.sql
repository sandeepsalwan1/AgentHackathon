-- Seed Mock Inbound Messages
insert into mock_inbound_messages (id, client_id, message_body, received_at)
values 
  ('98d10001-a1b2-c3d4-e5f6-7890abcdef01', 'c8d10001-a1b2-c3d4-e5f6-7890abcdef01', 'Buddy is throwing up and seems very lethargic today. He will not eat. Is there something I should give him or should I bring him in?', now() - interval '2 hours'),
  ('98d10002-a1b2-c3d4-e5f6-7890abcdef02', 'c8d10003-a1b2-c3d4-e5f6-7890abcdef03', 'Hi, I need to transfer Bellas records from Eastside Vet. Can you guys request them or should I email them to you?', now() - interval '1 hour')
on conflict (id) do nothing;

-- Seed Mock Call Transcripts
insert into mock_call_transcripts (id, client_id, transcript, received_at)
values 
  ('88d10001-a1b2-c3d4-e5f6-7890abcdef01', 'c8d10001-a1b2-c3d4-e5f6-7890abcdef01', 'Jane Doe: Hi, I just parked outside in spot #2. I am here with Buddy for our 2 PM appointment. Can you check us in? Agent: Yes, Jane. I see Buddy is scheduled with Dr. Shiv at 2 PM. I have checked you in. Buddy is number 2 in the queue, with an estimated wait time of 15 minutes. Please wait in your car and we will text you when we are ready.', now() - interval '30 minutes'),
  ('88d10002-a1b2-c3d4-e5f6-7890abcdef02', 'c8d10003-a1b2-c3d4-e5f6-7890abcdef03', 'Alice Johnson: Hi, I have an appointment for Bella tomorrow at 11 AM, but I need to reschedule it. Something came up. Agent: I can help with that. Let me look at available slots. We have slots on Tuesday at 9 AM or 10 AM, or Wednesday at 2 PM. Alice: Tuesday at 10 AM works great. Agent: Perfect, I have rescheduled Bella for Tuesday at 10 AM. You will receive a confirmation message shortly.', now() - interval '15 minutes')
on conflict (id) do nothing;

-- Seed Mock Invoices
insert into mock_invoices (id, client_id, total_amount, status, created_at)
values 
  ('18d10001-a1b2-c3d4-e5f6-7890abcdef01', 'c8d10002-a1b2-c3d4-e5f6-7890abcdef02', 120.00, 'paid', now() - interval '1 day'),
  ('18d10002-a1b2-c3d4-e5f6-7890abcdef02', 'c8d10001-a1b2-c3d4-e5f6-7890abcdef01', 250.00, 'unpaid', now())
on conflict (id) do nothing;

-- Seed Competitor Price Observations
insert into competitor_price_observations (id, competitor_name, service_name, price, observed_at)
values 
  ('78d10001-a1b2-c3d4-e5f6-7890abcdef01', 'VetsRUs Clinic', 'Annual Exam', 95.00, now() - interval '5 days'),
  ('78d10002-a1b2-c3d4-e5f6-7890abcdef02', 'VetsRUs Clinic', 'Rabies Vaccine', 42.00, now() - interval '5 days'),
  ('78d10003-a1b2-c3d4-e5f6-7890abcdef03', 'VetsRUs Clinic', 'Dental Cleaning', 290.00, now() - interval '5 days'),
  ('78d10004-a1b2-c3d4-e5f6-7890abcdef04', 'Happy Paws Center', 'Annual Exam', 78.00, now() - interval '3 days'),
  ('78d10005-a1b2-c3d4-e5f6-7890abcdef05', 'Happy Paws Center', 'Rabies Vaccine', 32.00, now() - interval '3 days'),
  ('78d10006-a1b2-c3d4-e5f6-7890abcdef06', 'Happy Paws Center', 'Dental Cleaning', 230.00, now() - interval '3 days')
on conflict (id) do nothing;
