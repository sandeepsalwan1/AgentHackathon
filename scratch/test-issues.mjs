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
    console.log(`Response Data:`, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error(`Error: ${err.message}`);
  }
}

async function main() {
  // Test 1: Pickup check for Max
  await testEndpoint(
    'Pickup status check for Max',
    '/api/agent/external',
    {
      clientName: 'jane smith',
      clientPhone: '(415) 555-0134',
      petName: 'Max',
      message: 'I want to know if my pet is ready for pickup'
    }
  );

  // Test 2: Followup refill check for Max
  await testEndpoint(
    'Followup/Refill check for Max',
    '/api/agent/external',
    {
      clientName: 'jane smith',
      clientPhone: '(415) 555-0134',
      petName: 'Max',
      message: 'I need a prescription refill for my pet'
    }
  );
}

main();
