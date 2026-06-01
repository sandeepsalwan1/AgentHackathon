// Native fetch is globally available in Node.js 18+

const baseUrl = 'http://localhost:3000';

async function testEndpoint(label, path, body) {
  console.log(`\n=== Testing: ${label} ===`);
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    console.log(`Status: ${res.status}`);
    console.log(`Message: ${data.message}`);
    console.log(`Requires Approval: ${data.result?.requiresApproval}`);
    if (data.task) {
      console.log(`Task Created - ID: ${data.task.id}, Status: ${data.task.status}, Request: "${data.task.request}"`);
      console.log(`Completed Info: name="${data.task.completedByName}", role="${data.task.completedByRole}", at="${data.task.completedAt}"`);
    } else {
      console.log('No Task Created.');
    }
    if (data.approval) {
      console.log(`Approval Created - ID: ${data.approval.id}, Title: "${data.approval.title}"`);
    } else {
      console.log('No Approval Created.');
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
  }
}

async function main() {
  // Test 1: Staff member clicks "Records" (vet-chat)
  await testEndpoint(
    'Staff records access (quick action)',
    '/api/agent/vet-chat',
    {
      message: 'Records',
      vetName: 'Dr. Jane S',
      intent: 'records'
    }
  );

  // Test 2: Pet owner accesses records
  await testEndpoint(
    'Pet owner records access (view records)',
    '/api/agent/external',
    {
      clientName: 'Hannah Kim',
      clientPhone: '(415) 555-0172',
      petName: 'Maple',
      message: "I'd like to access my pet's medical records"
    }
  );

  // Test 3: Pet owner transfers records
  await testEndpoint(
    'Pet owner records transfer (risky action)',
    '/api/agent/external',
    {
      clientName: 'Hannah Kim',
      clientPhone: '(415) 555-0172',
      petName: 'Maple',
      destination: 'Bayview Animal Clinic',
      message: "Please send Maple's vaccine records to Bayview Animal Clinic."
    }
  );

  // Test 4: Staff typing "biscuit"
  await testEndpoint(
    'Staff typing biscuit (pet name fallback)',
    '/api/agent/vet-chat',
    {
      message: 'biscuit',
      vetName: 'Dr. Jane S'
    }
  );

  // Test 5: Staff typing "Luna"
  await testEndpoint(
    'Staff typing Luna (pet name fallback)',
    '/api/agent/vet-chat',
    {
      message: 'Luna',
      vetName: 'Dr. Jane S'
    }
  );

  // Test 6: Registered owner Jane Smith with pet Max asks for records
  await testEndpoint(
    'Owner Jane Smith (pet Max) records request',
    '/api/agent/external',
    {
      clientName: 'jane smith',
      clientPhone: '(555) 000-0000',
      petName: 'Max',
      message: "I'd like to access my pet's medical records"
    }
  );

  // Test 7: Owner Jane Smith with pet Max types "Max"
  await testEndpoint(
    'Owner Jane Smith types "Max" (contextual fallback)',
    '/api/agent/external',
    {
      clientName: 'jane smith',
      clientPhone: '(555) 000-0000',
      petName: 'Max',
      message: "Max"
    }
  );
}

main();
