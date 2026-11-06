import { runSmartSearchAsync, SmartSearchConfig } from './src/lib/optimizer';
import { runSimulation } from './src/lib/simulator';

async function testOptimizerIntegration() {
  console.log('--- Testing HERMES Optimizer with Differential Evolution ---');

  const baseConfig: SmartSearchConfig = {
    Dc: 54, // mm
    Lc: 300, // mm
    Pmax_lim: 5.5, // MPa
    Dt0: 8.5, // mm
    Ds: 18.0, // mm
    alpha: 15,
    etac: 0.85,
    etanoz: 0.75,
    propellantId: 1, // KNDX
    shape: 1, // BATES
    grainCountMode: 'fixed',
    fixedGrainCount: 3,
    maxGrainCount: 4,
    modeD0: 'free',
    moded0: 'free',
    modeL0: 'free',
    osi: 0,
    ci: 1,
    ei: 1,
    goal: 'max_impulse',
    evaluationsPerN: 150 // quick test budget
  };

  // Test 1: Fixed N = 3
  console.log('Running Test 1: Fixed N = 3...');
  const resFixed = await runSmartSearchAsync(baseConfig);
  console.log(`Evaluations: ${resFixed.totalEvaluated}, Safe: ${resFixed.safeCount}, Candidates: ${resFixed.bestCandidates.length}`);
  
  if (resFixed.bestCandidates.length === 0) {
    throw new Error('Test 1 failed: No candidates returned');
  }
  const top1 = resFixed.bestCandidates[0];
  console.log(`Best Candidate Rank 1: N=${top1.config.grainCount}, It=${top1.metrics.totalImpulse} N*s, Pmax=${top1.metrics.maxPressure} MPa (limit 5.5)`);
  if (top1.metrics.maxPressure > 5.501) {
    throw new Error(`Test 1 failed: Overpressure candidate chosen! Pmax=${top1.metrics.maxPressure}`);
  }
  if (!top1.isSafe) {
    throw new Error('Test 1 failed: Best candidate is marked as unsafe!');
  }

  // Verification that independent simulation matches reported metrics
  const verifySim = runSimulation(top1.inputs);
  console.log(`Independent verification It: ${verifySim.summary.It_total_N_s.toFixed(1)} N*s vs Reported: ${top1.metrics.totalImpulse} N*s`);
  if (Math.abs(verifySim.summary.It_total_N_s - top1.metrics.totalImpulse) > 0.2) {
    throw new Error('Test 1 failed: Simulation metrics mismatch upon independent re-run!');
  }

  // Test 2: Automatic Grain Count N = 1..4
  console.log('\nRunning Test 2: Automatic Grain Count N = 1..4...');
  const resAuto = await runSmartSearchAsync({
    ...baseConfig,
    grainCountMode: 'range',
    maxGrainCount: 4,
    evaluationsPerN: 150
  });

  console.log(`Total evaluations: ${resAuto.totalEvaluated}`);
  console.log('Grain Summaries:');
  for (const g of resAuto.grainSummaries || []) {
    console.log(`  N=${g.N}: Best It = ${g.bestFeasibleImpulse} N*s (feasible: ${g.isFeasible})`);
  }

  const topAuto = resAuto.bestCandidates[0];
  console.log(`Winning Configuration across all N: N=${topAuto.config.grainCount}, It=${topAuto.metrics.totalImpulse} N*s, Pmax=${topAuto.metrics.maxPressure} MPa`);

  // Ensure topAuto is the max among all grain bests
  for (const g of resAuto.grainSummaries || []) {
    if (g.isFeasible && g.bestFeasibleImpulse !== null) {
      if (g.bestFeasibleImpulse > topAuto.metrics.totalImpulse + 0.1) {
        throw new Error(`Test 2 failed: Grain N=${g.N} had higher impulse (${g.bestFeasibleImpulse}) than chosen best (${topAuto.metrics.totalImpulse})!`);
      }
    }
  }

  // Test 3: Fixed variables test (D0 fixed, d0 fixed, L0 fixed)
  console.log('\nRunning Test 3: Fully Fixed variables...');
  const resFullyFixed = await runSmartSearchAsync({
    ...baseConfig,
    modeD0: 'fixed',
    valD0: 50,
    moded0: 'fixed',
    vald0: 12,
    modeL0: 'fixed',
    valL0: 80,
    evaluationsPerN: 100
  });
  console.log(`Fully Fixed Evaluations: ${resFullyFixed.totalEvaluated} (should be 1)`);
  if (resFullyFixed.totalEvaluated !== 1) {
    throw new Error('Test 3 failed: Fully fixed configuration evaluated more than 1 point!');
  }

  // Test 4: Shape 2 (Star grain)
  console.log('\nRunning Test 4: Shape 2 (Star grain)...');
  const resStar = await runSmartSearchAsync({
    ...baseConfig,
    shape: 2,
    fixedGrainCount: 2,
    evaluationsPerN: 120
  });
  console.log(`Star Grain Best Candidate: It=${resStar.bestCandidates[0]?.metrics.totalImpulse} N*s, Pmax=${resStar.bestCandidates[0]?.metrics.maxPressure} MPa`);
  if (resStar.bestCandidates.length === 0) {
    throw new Error('Test 4 failed: No star grain candidates');
  }

  // Test 5: Shape 3 (Solid grain)
  console.log('\nRunning Test 5: Shape 3 (Solid grain)...');
  const resSolid = await runSmartSearchAsync({
    ...baseConfig,
    shape: 3,
    fixedGrainCount: 1,
    ci: 0,
    evaluationsPerN: 80
  });
  console.log(`Solid Grain Best Candidate: It=${resSolid.bestCandidates[0]?.metrics.totalImpulse} N*s, Pmax=${resSolid.bestCandidates[0]?.metrics.maxPressure} MPa, d0=${resSolid.bestCandidates[0]?.config.d0}`);
  if (resSolid.bestCandidates[0]?.config.d0 !== 0) {
    throw new Error('Test 5 failed: Solid grain d0 must be 0!');
  }

  // Test 6: Deterministic reproducibility
  console.log('\nRunning Test 6: Deterministic Seed Reproducibility...');
  const seed = 123456789;
  const resSeed1 = await runSmartSearchAsync({ ...baseConfig, randomSeed: seed, evaluationsPerN: 100 });
  const resSeed2 = await runSmartSearchAsync({ ...baseConfig, randomSeed: seed, evaluationsPerN: 100 });
  console.log(`Run 1 It = ${resSeed1.bestCandidates[0]?.metrics.totalImpulse} vs Run 2 It = ${resSeed2.bestCandidates[0]?.metrics.totalImpulse}`);
  if (Math.abs((resSeed1.bestCandidates[0]?.metrics.totalImpulse || 0) - (resSeed2.bestCandidates[0]?.metrics.totalImpulse || 0)) > 1e-4) {
    throw new Error('Test 6 failed: Optimizer runs with identical seeds did not produce identical results!');
  }

  console.log('\n>>> All HERMES Optimizer Integration Tests Passed Successfully! <<<');
}

testOptimizerIntegration().catch(err => {
  console.error('Integration test failed:', err);
  process.exit(1);
});
