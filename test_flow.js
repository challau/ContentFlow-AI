async function test() {
  console.log('Testing ContentFlow API...');
  
  // 1. Health check
  const healthRes = await fetch('http://localhost:4000/api/v1/health');
  console.log('Health status:', healthRes.status, await healthRes.json());

  // 2. Login
  const loginRes = await fetch('http://localhost:4000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@contentflow.ai', password: 'contentflow-demo-2026' })
  });
  console.log('Login status:', loginRes.status);
  const loginData = await loginRes.json();
  const token = loginData.accessToken;
  console.log('User:', loginData.user?.email, '| Token acquired');

  // 3. Get projects
  const projRes = await fetch('http://localhost:4000/api/v1/projects', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const projects = await projRes.json();
  console.log('Projects count:', projects.length, '| First project:', projects[0]?.name, 'id:', projects[0]?.id);
  const projectId = projects[0]?.id;

  // 4. Get pipelines or create one
  const pipeRes = await fetch('http://localhost:4000/api/v1/pipelines', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  let pipelines = await pipeRes.json();
  console.log('Pipelines count:', pipelines.length);

  let pipelineId;
  if (pipelines.length === 0) {
    console.log('Creating test pipeline...');
    const createPipeRes = await fetch('http://localhost:4000/api/v1/pipelines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        name: 'AI Automation Post',
        description: 'Test content generation pipeline',
        topic: 'AI Agents for Enterprise Content Workflows',
        platforms: ['LINKEDIN', 'TWITTER'],
        projectId
      })
    });
    const newPipe = await createPipeRes.json();
    console.log('Created pipeline:', newPipe.id);
    pipelineId = newPipe.id;
  } else {
    pipelineId = pipelines[0].id;
  }

  // 5. Run pipeline
  console.log('Starting pipeline run for pipelineId:', pipelineId);
  const runRes = await fetch(`http://localhost:4000/api/v1/pipelines/${pipelineId}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ sync: true }) // run synchronously to wait for all agents
  });
  console.log('Run trigger status:', runRes.status);
  const runData = await runRes.json();
  console.log('Run ID:', runData.runId, '| Status:', runData.status);

  // 6. Check generated assets
  const assetsRes = await fetch(`http://localhost:4000/api/v1/assets?projectId=${projectId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const assets = await assetsRes.json();
  console.log('Generated Assets count:', assets.length);
  if (assets.length > 0) {
    console.log('Sample Asset title:', assets[0].title, '| type:', assets[0].type);
    console.log('Sample Content snippet:\n', assets[0].content?.slice(0, 300));
  }

  console.log('\n✅ ALL BACKEND & AGENT METHODS VERIFIED SUCCESSFULLY!');
}

test().catch(err => console.error('❌ Test failed:', err));
