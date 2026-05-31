-- Seed Clients
insert into clients (id, name, phone, email, date_of_birth, created_at)
values 
  ('c8d10001-a1b2-c3d4-e5f6-7890abcdef01', 'Jane Doe', '555-0199', 'jane.doe@example.com', '1985-05-15', now()),
  ('c8d10002-a1b2-c3d4-e5f6-7890abcdef02', 'John Smith', '555-0144', 'john.smith@example.com', '1978-09-22', now()),
  ('c8d10003-a1b2-c3d4-e5f6-7890abcdef03', 'Alice Johnson', '555-0177', 'alice.j@example.com', '1992-11-02', now())
on conflict (id) do nothing;

-- Seed Pets
insert into pets (id, client_id, name, species, breed, weight, date_of_birth, created_at)
values 
  ('d8d10001-a1b2-c3d4-e5f6-7890abcdef01', 'c8d10001-a1b2-c3d4-e5f6-7890abcdef01', 'Buddy', 'dog', 'Golden Retriever', '65 lbs', '2020-01-10', now()),
  ('d8d10002-a1b2-c3d4-e5f6-7890abcdef02', 'c8d10002-a1b2-c3d4-e5f6-7890abcdef02', 'Max', 'cat', 'Domestic Shorthair', '12 lbs', '2018-04-18', now()),
  ('d8d10003-a1b2-c3d4-e5f6-7890abcdef03', 'c8d10003-a1b2-c3d4-e5f6-7890abcdef03', 'Bella', 'dog', 'Poodle', '18 lbs', '2022-07-05', now())
on conflict (id) do nothing;

-- Seed Appointments (Today, Yesterday, Tomorrow)
insert into appointments (id, client_id, pet_id, doctor_id, start_time, end_time, status, reason, created_at)
values 
  ('a8d10001-a1b2-c3d4-e5f6-7890abcdef01', 'c8d10001-a1b2-c3d4-e5f6-7890abcdef01', 'd8d10001-a1b2-c3d4-e5f6-7890abcdef01', 'Dr. Shiv', current_date + interval '14 hours', current_date + interval '14 hours 30 minutes', 'scheduled', 'Annual Checkup & Rabies booster', now()),
  ('a8d10002-a1b2-c3d4-e5f6-7890abcdef02', 'c8d10002-a1b2-c3d4-e5f6-7890abcdef02', 'd8d10002-a1b2-c3d4-e5f6-7890abcdef02', 'Dr. Raj', current_date - interval '1 day' + interval '10 hours', current_date - interval '1 day' + interval '10 hours 30 minutes', 'completed', 'Ear Infection check', now()),
  ('a8d10003-a1b2-c3d4-e5f6-7890abcdef03', 'c8d10003-a1b2-c3d4-e5f6-7890abcdef03', 'd8d10003-a1b2-c3d4-e5f6-7890abcdef03', 'Dr. Shiv', current_date + interval '1 day' + interval '11 hours', current_date + interval '1 day' + interval '11 hours 30 minutes', 'scheduled', 'Vaccines', now())
on conflict (id) do nothing;

-- Seed Available Slots for Next Week
insert into appointment_slots (id, doctor_id, start_time, end_time, is_booked)
values 
  ('b8d10001-a1b2-c3d4-e5f6-7890abcdef01', 'Dr. Shiv', current_date + interval '2 days' + interval '9 hours', current_date + interval '2 days' + interval '9 hours 30 minutes', false),
  ('b8d10002-a1b2-c3d4-e5f6-7890abcdef02', 'Dr. Shiv', current_date + interval '2 days' + interval '10 hours', current_date + interval '2 days' + interval '10 hours 30 minutes', false),
  ('b8d10003-a1b2-c3d4-e5f6-7890abcdef03', 'Dr. Raj', current_date + interval '2 days' + interval '14 hours', current_date + interval '2 days' + interval '14 hours 30 minutes', false),
  ('b8d10004-a1b2-c3d4-e5f6-7890abcdef04', 'Dr. Raj', current_date + interval '3 days' + interval '11 hours', current_date + interval '3 days' + interval '11 hours 30 minutes', false),
  ('b8d10005-a1b2-c3d4-e5f6-7890abcdef05', 'Dr. Shiv', current_date + interval '3 days' + interval '15 hours', current_date + interval '3 days' + interval '15 hours 30 minutes', false)
on conflict (id) do nothing;

-- Seed Wait Statuses
insert into wait_statuses (id, pet_id, queue_position, wait_minutes, status, message, updated_at)
values 
  ('e8d10001-a1b2-c3d4-e5f6-7890abcdef01', 'd8d10001-a1b2-c3d4-e5f6-7890abcdef01', 2, 15, 'scheduled', 'Buddy is scheduled for today. Ready for check-in.', now())
on conflict (id) do nothing;

-- Seed Service Catalog
insert into service_catalog (id, service_name, price, category)
values 
  ('08d10001-a1b2-c3d4-e5f6-7890abcdef01', 'Annual Exam', 85.00, 'consultation'),
  ('08d10002-a1b2-c3d4-e5f6-7890abcdef02', 'Rabies Vaccine', 35.00, 'prevention'),
  ('08d10003-a1b2-c3d4-e5f6-7890abcdef03', 'DHPP Vaccine', 45.00, 'prevention'),
  ('08d10004-a1b2-c3d4-e5f6-7890abcdef04', 'FVRCP Vaccine', 40.00, 'prevention'),
  ('08d10005-a1b2-c3d4-e5f6-7890abcdef05', 'Fecal Exam', 45.00, 'diagnostic'),
  ('08d10006-a1b2-c3d4-e5f6-7890abcdef06', 'Dental Cleaning', 250.00, 'dental'),
  ('08d10007-a1b2-c3d4-e5f6-7890abcdef07', 'Microchipping', 55.00, 'general')
on conflict (id) do nothing;

-- Seed Follow Up Candidates
insert into followup_candidates (id, client_id, pet_id, follow_up_reason, due_date, status, created_at)
values 
  ('f8d10001-a1b2-c3d4-e5f6-7890abcdef01', 'c8d10002-a1b2-c3d4-e5f6-7890abcdef02', 'd8d10002-a1b2-c3d4-e5f6-7890abcdef02', 'Rabies Booster Due', current_date + interval '7 days', 'pending', now()),
  ('f8d10002-a1b2-c3d4-e5f6-7890abcdef02', 'c8d10001-a1b2-c3d4-e5f6-7890abcdef01', 'd8d10001-a1b2-c3d4-e5f6-7890abcdef01', 'Dental Cleaning Recheck', current_date + interval '14 days', 'pending', now())
on conflict (id) do nothing;
